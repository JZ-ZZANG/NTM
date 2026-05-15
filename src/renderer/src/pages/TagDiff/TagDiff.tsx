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
 * 두 JSON 문자열을 줄 단위로 비교.
 * 각 줄에서 key를 추출해 매칭하고, 값이 다르면 'different',
 * 한쪽에만 있으면 'only-left' / 'only-right', 같으면 'same'.
 */
function jsonLineDiff(
  leftJson: string,
  rightJson: string,
): { left: LineDiff[]; right: LineDiff[]; diffCount: number } {
  const lLines = leftJson.split('\n');
  const rLines = rightJson.split('\n');

  const extractKey = (line: string) => {
    const m = line.match(/^\s*"([^"]+)"/);
    return m ? m[1] : null;
  };

  // key → 왼쪽 줄 인덱스 목록
  const lKeyMap = new Map<string, number[]>();
  lLines.forEach((line, i) => {
    const k = extractKey(line);
    if (k) {
      if (!lKeyMap.has(k)) lKeyMap.set(k, []);
      lKeyMap.get(k)!.push(i);
    }
  });

  const lMatched = new Set<number>();
  const rMatched = new Set<number>();
  // `li:ri` → DiffStatus
  const pairMap = new Map<string, DiffStatus>();

  rLines.forEach((rLine, ri) => {
    const k = extractKey(rLine);
    if (!k) return;
    const candidates = lKeyMap.get(k) ?? [];
    for (const li of candidates) {
      if (lMatched.has(li)) continue;
      lMatched.add(li);
      rMatched.add(ri);
      const st: DiffStatus =
        lLines[li].trimEnd() === rLine.trimEnd() ? 'same' : 'different';
      pairMap.set(`${li}:${ri}`, st);
      break;
    }
  });

  const resolveLeft = (i: number): DiffStatus => {
    if (!lMatched.has(i)) {
      // key가 없는 줄(괄호, 공백 등)은 same으로
      return extractKey(lLines[i]) ? 'only-left' : 'same';
    }
    for (const [k, st] of pairMap) {
      if (k.startsWith(`${i}:`)) return st;
    }
    return 'same';
  };

  const resolveRight = (i: number): DiffStatus => {
    if (!rMatched.has(i)) {
      return extractKey(rLines[i]) ? 'only-right' : 'same';
    }
    for (const [k, st] of pairMap) {
      if (k.endsWith(`:${i}`)) return st;
    }
    return 'same';
  };

  const left: LineDiff[] = lLines.map((text, i) => ({
    lineNum: i + 1,
    text,
    status: resolveLeft(i),
  }));

  const right: LineDiff[] = rLines.map((text, i) => ({
    lineNum: i + 1,
    text,
    status: resolveRight(i),
  }));

  const diffCount =
    left.filter(l => l.status !== 'same').length +
    right.filter(r => r.status !== 'same').length;

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
    return jsonLineDiff(leftRaw, rightRaw);
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