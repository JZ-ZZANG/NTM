# AI 지침
- 작업은 꼭 필요한 것만 순서를 지켜 엄격하게 이루어져야합니다.
- 프론트와 백엔드는 분리되어야 하며, 
- 예시 파일을 아무데나 작성하는 것은 절대 금기입니다. 프로젝트의 구조를 미리 정확히 정의하고, 처음부터 올바른 위치에 파일을 작성하여야합니다.
- 주석 갱신만을 위해 코드를 갱신하는 행위를 하지 마세요. 실제 코드가 같다면 편집은 불필요합니다.

# NAI Tag Manager
- 이 문서는 NAI Tag Manager 프로젝트의 현재 진행 상황과 앞으로의 개발 계획을 정리합니다.

## 프로젝트 설정
- Vite + React + Electron 기반 데스크톱 앱
- 이미지 처리: sharp 라이브러리 등
- 자세한건 추후 설정

## 작업순서
1. 프로젝트 구조 사전 정의
2. 기본 UI 구성
3. 전체 프로그램 기능(언어변경,UI관련, 설정 저장 등)
4. 페이지 별 기능 구성

## UI 구성
- 기본 상단바 제거. 커스텀 상단바 사용 (초기에는 최소화,창모드/전체화면/닫기 버튼만 배치)
- 기본 상단 메뉴바 제거
- 사이드바 사용. 사이드바에는 각 기능별 페이지로 이동할 수 있는 버튼 배치 예정
- 상단바와 사이드바는 구역을 작게 가져가, 메인 영역이 넓게 되도록 하며, 버튼을 클릭해 다른 페이지로 이동하더라도 상시 화면안에 남아있도록

## 폴더 구성
- 프론트/백엔드 분리
- 프론트에서 공통 컴포넌트 분리
- legacy 폴더는 이전 개발 기록의 흔적이므로 신경쓰지 않아도 됨

## 전체 기능
- 언어 설정(한국어,영어,일본어)
- 설정 자동 저장 및 백업 기능(다른 컴퓨터로 이동시 전체 설정을 json 파일 등으로 백업/복원 가능한 기능)
- 기타 추후 개발


---
[프로젝트 구조]
```text
NAI_tag_manager/
├── src/
│   ├── main/                 # Electron Main Process (Backend)
│   │   ├── index.ts          # Electron 진입점 및 윈도우 관리
│   │   ├── preload.ts        # IPC 브릿지 (Main <-> Renderer 통신)
│   │   └── services/         # 실제 비즈니스 로직
│   │       ├── imageService.ts   # sharp를 이용한 이미지 처리 (태그 제거 등)
│   │       ├── configService.ts  # 설정 파일 저장 및 로드 (JSON)
│   │       ├── tagService.ts     # Danbooru 태그 검색 및 제안 로직
│   │       └── i18nService.ts    # 다국어 데이터 관리
│   ├── renderer/             # React Renderer Process (Frontend)
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── App.tsx       # 전체 라우팅 및 레이아웃 정의
│   │   │   ├── main.tsx      # React 진입점
│   │   │   ├── components/   # 공통 컴포넌트
│   │   │   │   ├── layout/   # TitleBar, SideBar 등 레이아웃 컴포넌트
│   │   │   │   └── common/   # Button, Input 등 공통 UI 요소
│   │   │   ├── pages/        # 각 기능별 페이지
│   │   │   │   ├── Home.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── hooks/        # 커스텀 훅 (IPC 통신 래핑 등)
│   │   │   ├── store/        # 전역 상태 관리 (Zustand 등)
│   │   │   └── assets/       # 이미지, 아이콘, 스타일 (SCSS/Tailwind)
│   │   └── public/           # 정적 파일
│   └── shared/               # Main과 Renderer가 공유하는 타입 정의
│       └── types.ts          # Settings, Task 등 공용 인터페이스
├── resources/                # 앱 패키징 시 필요한 리소스 (아이콘 등)
├── locales/                  # 다국어 지원 JSON 파일 (ko.json, en.json, ja.json)
├── data/                     # 대용량 정적 데이터 (tags.json 등)
├── package.json              # 의존성 및 스크립트 설정 및 빌드 배포 설정
├── vite.config.ts            # Vite 빌드 설정
└── tsconfig.json             # TypeScript 설정
```

### 구조 설계 의도
1. **관심사 분리**: `src/main`은 OS 수준의 API(파일 시스템, 이미지 처리)를 담당하고, `src/renderer`는 오직 UI와 사용자 경험에 집중합니다.
2. **보안**: `preload.ts`를 통해 Renderer Process에서 Main Process의 민감한 API에 직접 접근하는 것을 차단하고, 필요한 기능만 노출합니다.
3. **유지보수**: 다국어 파일(`locales/`)과 공용 타입(`shared/`)을 분리하여 코드의 일관성을 유지합니다.