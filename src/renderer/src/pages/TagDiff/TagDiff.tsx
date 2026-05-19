import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import PageContainer from '../../components/layout/PageContainer';
import './TagDiff.css';

// Diff 유틸
type DiffStatus = 'same' | 'different' | 'only-left' | 'only-right';

interface LineDiff {
  lineNum: number;
  text: string;
  status: DiffStatus;
}

/**
 * LCS 기반 줄 단위 diff (diffchecker 방식).
 * 두 텍스트를 줄 배열로 나눈 뒤 LCS로 공통 줄을 찾고,
 * 나머지를 removed/added로 분류한 다음 인접한 removed+added 쌍을 'different'로 묶음.
 */
type RawOp = { type: 'same' | 'removed' | 'added'; text: string };

function lcsLineDiff(leftJson: string, rightJson: string): {
  left: LineDiff[];
  right: LineDiff[];
  diffCount: number;
} {
  const lLines = leftJson.split('\n');
  const rLines = rightJson.split('\n');
  const lLen = lLines.length;
  const rLen = rLines.length;

  // LCS DP (길이만)
  const dp: number[][] = Array.from({ length: lLen + 1 }, () => new Array(rLen + 1).fill(0));
  for (let i = lLen - 1; i >= 0; i--) {
    for (let j = rLen - 1; j >= 0; j--) {
      if (lLines[i] === rLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // LCS 역추적으로 ops 생성
  const lOps: RawOp[] = [];
  const rOps: RawOp[] = [];
  let i = 0, j = 0;
  while (i < lLen && j < rLen) {
    if (lLines[i] === rLines[j]) {
      lOps.push({ type: 'same', text: lLines[i] });
      rOps.push({ type: 'same', text: rLines[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lOps.push({ type: 'removed', text: lLines[i] });
      i++;
    } else {
      rOps.push({ type: 'added', text: rLines[j] });
      j++;
    }
  }
  while (i < lLen) { lOps.push({ type: 'removed', text: lLines[i++] }); }
  while (j < rLen) { rOps.push({ type: 'added', text: rLines[j++] }); }

  // removed + added 인접 쌍을 'different'로 승격
  // lOps의 removed와 rOps의 added가 같은 위치에 있으면 different
  const promoteToLineDiff = (
    lRaw: RawOp[],
    rRaw: RawOp[],
  ): { left: LineDiff[]; right: LineDiff[] } => {
    // same 줄 기준으로 청크를 나눠 removed↔added를 짝지음
    const left: LineDiff[] = [];
    const right: LineDiff[] = [];

    let li = 0, ri = 0;
    let lNum = 1, rNum = 1;

    while (li < lRaw.length || ri < rRaw.length) {
      const lOp = lRaw[li];
      const rOp = rRaw[ri];

      // 양쪽 same
      if (lOp?.type === 'same' && rOp?.type === 'same') {
        left.push({ lineNum: lNum++, text: lOp.text, status: 'same' });
        right.push({ lineNum: rNum++, text: rOp.text, status: 'same' });
        li++; ri++;
        continue;
      }

      // removed 블록 + added 블록 수집
      const removedBlock: string[] = [];
      const addedBlock: string[] = [];

      while (li < lRaw.length && lRaw[li].type === 'removed') {
        removedBlock.push(lRaw[li++].text);
      }
      while (ri < rRaw.length && rRaw[ri].type === 'added') {
        addedBlock.push(rRaw[ri++].text);
      }

      // removed와 added가 같은 수면 → different (줄 단위 쌍)
      // 수가 다르면 → 많은 쪽을 only-left/only-right, 나머지를 different
      const pairCount = Math.min(removedBlock.length, addedBlock.length);
      for (let k = 0; k < pairCount; k++) {
        const st: DiffStatus = removedBlock[k] === addedBlock[k] ? 'same' : 'different';
        left.push({ lineNum: lNum++, text: removedBlock[k], status: st });
        right.push({ lineNum: rNum++, text: addedBlock[k], status: st });
      }
      for (let k = pairCount; k < removedBlock.length; k++) {
        left.push({ lineNum: lNum++, text: removedBlock[k], status: 'only-left' });
      }
      for (let k = pairCount; k < addedBlock.length; k++) {
        right.push({ lineNum: rNum++, text: addedBlock[k], status: 'only-right' });
      }
    }

    return { left, right };
  };

  const { left, right } = promoteToLineDiff(lOps, rOps);
  const diffCount = left.filter(l => l.status !== 'same').length
                  + right.filter(r => r.status !== 'same').length;

  return { left, right, diffCount };
}

// CopyButton
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="copy-btn-wrapper">
      {copied && <span className="copy-status-msg">{t('tagViewer.copied')}</span>}
      <button className="copy-btn-action" onClick={handleCopy} disabled={!text}>
        {t('tagViewer.copy')}
      </button>
    </div>
  );
};

// DropPanel
const DropPanel: React.FC<{ side: 'left' | 'right'; onFileAccepted: (f: File) => void }> = ({
  side,
  onFileAccepted,
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const imageRegex = /\.(jpe?g|png|webp)$/i;
      const f = acceptedFiles.find(f => {
        const hasExt = f.name.includes('.');
        return !hasExt || imageRegex.test(f.name);
      });
      if (f) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
        setFileName(f.name);
        onFileAccepted(f);
      }
    },
    [onFileAccepted, previewUrl],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    getFilesFromEvent: async event => {
      const dt = (event as any).dataTransfer || (event as any).target;
      return Array.from(dt?.files || []) as File[];
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone td-dropzone ${isDragActive ? 'active' : ''} ${previewUrl ? 'has-image' : ''}`}
    >
      <input {...getInputProps()} />
      {!previewUrl ? (
        <div className="td-dropzone-placeholder">
          <p className="td-dropzone-hint">{t('tagViewer.dropzone')}</p>
        </div>
      ) : (
        <div className="td-image-preview">
          <img src={previewUrl} alt="Preview" className="td-preview-img" />
          <div className="td-preview-overlay">
            <p className="td-preview-filename">{fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// DiffCodeBox
const statusClass: Record<DiffStatus, string> = {
  same: '',
  different: 'td-line-different',
  'only-left': 'td-line-only',
  'only-right': 'td-line-only',
};

const DiffCodeBox: React.FC<{
  title: string;
  rawJson: string;
  lines: LineDiff[];
  bothLoaded: boolean;
}> = ({ title, rawJson, lines, bothLoaded }) => (
  <div className="td-raw-box">
    <div className="td-raw-header">
      <span className="td-raw-title">{title}</span>
      <CopyButton text={rawJson} />
    </div>
    <div className="td-raw-content">
      {!rawJson ? (
        <span className="empty-placeholder">—</span>
      ) : (
        <div className="td-code-block">
          {lines.map((line, i) => {
            const cls = bothLoaded ? statusClass[line.status] : '';
            return (
              <div key={i} className={`td-code-line ${cls}`}>
                <span className="td-line-num">{line.lineNum}</span>
                <span className="td-line-text">{line.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

// TagDiff (main)
const TagDiff: React.FC = () => {
  const { t } = useTranslation();
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);
  const [leftMeta, setLeftMeta] = useState<any | null>(null);
  const [rightMeta, setRightMeta] = useState<any | null>(null);

  const extractMeta = async (file: File): Promise<any | null> => {
    const path = (file as any).path || file.name;
    if (window.electronAPI) {
      try {
        return await window.electronAPI.extractImageMetadata(path);
      } catch {
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    if (leftFile) extractMeta(leftFile).then(setLeftMeta);
    else setLeftMeta(null);
  }, [leftFile]);

  useEffect(() => {
    if (rightFile) extractMeta(rightFile).then(setRightMeta);
    else setRightMeta(null);
  }, [rightFile]);

  const bothLoaded = leftMeta !== null && rightMeta !== null;
  const leftRaw = leftMeta ? JSON.stringify(leftMeta, null, 2) : '';
  const rightRaw = rightMeta ? JSON.stringify(rightMeta, null, 2) : '';

  const toPlainLines = (raw: string): LineDiff[] =>
    raw.split('\n').map((text, i) => ({ lineNum: i + 1, text, status: 'same' as DiffStatus }));

  const { left: leftLines, right: rightLines, diffCount } = useMemo(() => {
    if (!bothLoaded) {
      return { left: toPlainLines(leftRaw), right: toPlainLines(rightRaw), diffCount: 0 };
    }
    return lcsLineDiff(leftRaw, rightRaw);
  }, [leftRaw, rightRaw, bothLoaded]);

  return (
    <PageContainer title={t('sideBar.tagDiff')} info={t('tagDiff.pageInfo')}>
      <div className="td-root">
        {bothLoaded && (
          <div className="td-statusbar">
            <span className={`td-status-dot ${diffCount > 0 ? 'diff' : 'same'}`} />
            {diffCount > 0
              ? t('tagDiff.statusDiff', { count: diffCount })
              : t('tagDiff.statusSame')}
          </div>
        )}

        <div className="td-panels">
          <div className="td-panel">
            <DropPanel side="left" onFileAccepted={setLeftFile} />
            <DiffCodeBox
              title={t('tagDiff.rawDataA')}
              rawJson={leftRaw}
              lines={leftLines}
              bothLoaded={bothLoaded}
            />
          </div>

          <div className="td-divider">
            <div className="td-divider-line" />
            <span className="td-divider-icon">⇄</span>
            <div className="td-divider-line" />
          </div>

          <div className="td-panel">
            <DropPanel side="right" onFileAccepted={setRightFile} />
            <DiffCodeBox
              title={t('tagDiff.rawDataB')}
              rawJson={rightRaw}
              lines={rightLines}
              bothLoaded={bothLoaded}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default TagDiff;