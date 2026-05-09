import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import PageContainer from '../../components/layout/PageContainer';
import './TagViewer.css';

interface DroppedItem {
  name: string;
  path: string;
}

interface CharCaption {
  char_caption: string;
  centers: { x: number; y: number }[];
}

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

const MetadataSection: React.FC<{ title: string; content?: string; children?: React.ReactNode }> = ({ title, content, children }) => {
  return (
    <div className="metadata-section">
      <h4>{title}</h4>
      <div className="metadata-content-box">
        {content !== undefined ? (
          <div className="sub-section">
            <div className="sub-section-header no-label">
              <CopyButton text={content} />
            </div>
            <div className="sub-text">
              {content || <span className="empty-placeholder">—</span>}
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
};

const TagViewer: React.FC = () => {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<DroppedItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // 이미지 프리뷰 URL 해제 (메모리 관리)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageRegex = /\.(jpe?g|png|webp)$/i;

    const imageFile = acceptedFiles.find((f: any) => {
      const hasExtension = f.name.includes('.');
      return !hasExtension || imageRegex.test(f.name);
    });

    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      setSelectedImage({
        name: imageFile.name,
        path: (imageFile as any).path || imageFile.name,
      });
      setMetadata(null);
      setMetadataError(null);
    } else {
      setSelectedImage(null);
      setPreviewUrl(null);
      setMetadata(null);
      setMetadataError(null);
    }
  }, []);

  useEffect(() => {
    const extractMetadata = async () => {
      if (selectedImage && window.electronAPI) {
        setMetadataError(null);
        try {
          const extracted = await window.electronAPI.extractImageMetadata(selectedImage.path);
          if (extracted) {
            setMetadata(extracted);
          } else {
            setMetadataError(t('tagViewer.noMetadataFound'));
          }
        } catch (error: any) {
          console.error('Failed to extract metadata:', error);
          setMetadataError(t('tagViewer.noMetadataFound'));
        }
      }
    };

    extractMetadata();
  }, [selectedImage, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    getFilesFromEvent: async (event) => {
      const dataTransfer = (event as any).dataTransfer || (event as any).target;
      return Array.from(dataTransfer?.files || []) as File[];
    },
  });

  const renderMetadata = (data: any) => {
    const comment = data ? (data.Comment || data) : null;
    const source = data?.Source || '';

    const positivePrompt = comment?.v4_prompt?.caption?.base_caption || comment?.prompt || '';
    const negativePrompt = comment?.v4_negative_prompt?.caption?.base_caption || comment?.uc || '';
    const charCaptions: CharCaption[] = comment?.v4_prompt?.caption?.char_captions || [];
    const charNegCaptions: CharCaption[] = comment?.v4_negative_prompt?.caption?.char_captions || [];

    const settings: Record<string, any> = comment ? {
      Steps: comment.steps,
      Scale: comment.scale,
      Rescale: comment.cfg_rescale,
      Seed: comment.seed,
      Size: `${comment.width}x${comment.height}`,
      Sampler: comment.sampler,
      Schedule: comment.noise_schedule,
      Source: source,
    } : {};

    const settingsText = Object.entries(settings)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const charCount = Math.max(charCaptions.length, charNegCaptions.length, 1);

    return (
      <div className="metadata-display">
        {/* 1. 긍정 프롬프트 */}
        <MetadataSection title={t('tagViewer.positivePrompt')} content={positivePrompt} />

        {/* 2. 부정 프롬프트 */}
        <MetadataSection title={t('tagViewer.negativePrompt')} content={negativePrompt} />

        {/* 3. 캐릭터 블록 */}
        {Array.from({ length: charCount }).map((_, idx) => {
          const charPos = charCaptions[idx]?.char_caption || '';
          const charNeg = charNegCaptions[idx]?.char_caption || '';
          const label = charCount > 1
            ? `${t('tagViewer.charPrompt')} ${idx + 1}`
            : t('tagViewer.charPrompt');

          return (
            <MetadataSection key={idx} title={label}>
              <div className="sub-section">
                <div className="sub-section-header">
                  <span>{t('tagViewer.positivePrompt')}</span>
                  <CopyButton text={charPos} />
                </div>
                <div className="sub-text">{charPos || <span className="empty-placeholder">—</span>}</div>
              </div>
              <div className="sub-section">
                <div className="sub-section-header">
                  <span>{t('tagViewer.negativePrompt')}</span>
                  <CopyButton text={charNeg} />
                </div>
                <div className="sub-text">{charNeg || <span className="empty-placeholder">—</span>}</div>
              </div>
            </MetadataSection>
          );
        })}

        {/* 4. 생성 설정 */}
        <MetadataSection title={t('tagViewer.settings')}>
          <div className="settings-grid">
            {Object.entries(settings).map(([key, val]) => (
              <div key={key} className="setting-item">
                <span className="setting-key">{key}:</span>{' '}
                <span className="setting-value">{String(val)}</span>
              </div>
            ))}
          </div>
        </MetadataSection>
      </div>
    );
  };

  return (
    <PageContainer
      title={t('sideBar.tagViewer')}
      info={t('tagViewer.pageInfo')}
    >
      <div className="tag-viewer-container">
        <div className="viewer-left-panel">
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            {!previewUrl ? (
              <p>{t('tagViewer.dropzone')}</p>
            ) : (
              <div className="selected-image-preview">
                <img src={previewUrl} alt="Preview" className="preview-img" />
                <div className="preview-overlay">
                  <p className="selected-image-name">{selectedImage?.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="viewer-right-panel">
          <div className="metadata-panel-header">
            <h3>{t('tagViewer.metadataTitle')}</h3>
          </div>
          <div className="metadata-panel-content">
            {metadataError ? (
              <p className="error-text">{metadataError}</p>
            ) : (
              renderMetadata(metadata)
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default TagViewer;