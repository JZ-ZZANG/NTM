import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../../../shared/types';
import './TagInput.css';

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  'general': { label: 'general', color: '#4da3ff' },
  'artist': { label: 'artist', color: '#ff904d' },
  'copyright': { label: 'copyright', color: '#d77cff' },
  'character': { label: 'character', color: '#50e3c2' },
  'meta': { label: 'meta', color: '#e81123' },
};

/**
 * Textarea 내의 커서 좌표(x, y)를 계산합니다.
 */
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);
  for (const prop of style) {
    div.style[prop as any] = style.getPropertyValue(prop);
  }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  
  const text = element.value.substring(0, position);
  div.textContent = text;
  
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);
  
  document.body.appendChild(div);
  const { offsetTop: top, offsetLeft: left } = span;
  document.body.removeChild(div);
  return { top, left };
};

export const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder }) => {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const listRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!textareaRef.current || document.activeElement !== textareaRef.current) {
        setSuggestions([]);
        return;
      }

      const cursor = textareaRef.current.selectionStart;
      const textBeforeCursor = value.substring(0, cursor);
      // 쉼표(,) 또는 줄바꿈(\n)으로 분리하여 현재 입력 중인 세그먼트 추출
      const segments = textBeforeCursor.split(/[,\n]/);
      const currentQuery = segments[segments.length - 1]?.trim() || '';
      
      if (currentQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      const results = await window.electronAPI.suggestTags(currentQuery);
      setSuggestions(results);
      setSelectedIndex(-1);

      // 커서 위치에 맞춰 메뉴 위치 계산
      if (textareaRef.current && results.length > 0) {
        const rect = textareaRef.current.getBoundingClientRect();
        const coords = getCaretCoordinates(textareaRef.current, textareaRef.current.selectionStart);
        setMenuPos({
          top: rect.top + coords.top + 10 - textareaRef.current.scrollTop,
          left: rect.left + coords.left
        });
      }
    };

    const timer = setTimeout(fetchSuggestions, 200); // 디바운스
    return () => clearTimeout(timer);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleSelect(suggestions[selectedIndex].value);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  const handleSelect = (tagName: string) => {
    if (!textareaRef.current) return;

    const cursor = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursor);
    const textAfterCursor = value.substring(cursor);

    // 커서 이전에서 가장 가까운 구분자(쉼표 또는 줄바꿈) 위치 찾기
    const lastSeparatorIndex = Math.max(
      textBeforeCursor.lastIndexOf(','),
      textBeforeCursor.lastIndexOf('\n')
    );

    const prefix = value.substring(0, lastSeparatorIndex + 1);
    const padding = (prefix.length > 0 && !prefix.endsWith('\n') && !prefix.endsWith(' ')) ? ' ' : '';
    
    // 기존 태그를 선택한 태그로 교체하고 뒤에 쉼표 추가
    const newValue = prefix + padding + tagName + ', ' + textAfterCursor.replace(/^\s+/, '');
    
    onChange(newValue);
    setSuggestions([]);
    textareaRef.current.focus();
  };

  return (
    <div className="tag-input-wrapper">
      <textarea
        ref={textareaRef}
        className="option-control tag-search-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestions([]), 200)}
        placeholder={placeholder || t('common.tagPlaceholder')}
      />
      {suggestions.length > 0 && (
        <ul 
          className="suggestions-list" 
          ref={listRef}
          onMouseDown={(e) => e.preventDefault()} // 스크롤바 클릭 시 포커스 해제 방지
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {suggestions.map((tag, index) => (
            <li
              key={`${tag.value}-${tag.type}`}
              className={`suggestion-item ${index === selectedIndex ? 'active' : ''}`}
              onClick={() => handleSelect(tag.value)}
            >
              <div className="suggestion-left">
                <span className="tag-name">{tag.value.replace(/_/g, ' ')}</span>
              </div>
              <div className="suggestion-right">
                <span 
                  className="tag-category" 
                  style={{ color: CATEGORY_MAP[String(tag.type)]?.color || 'var(--text-step-3)' }}
                >
                  {CATEGORY_MAP[String(tag.type)]?.label || t('common.tag')}
                </span>
                <span className="tag-count">{(tag.count || 0).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};