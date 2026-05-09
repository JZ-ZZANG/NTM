# NTM - NAI Tag Manager

- NTM은 NAI 및 NAIS2 사용자를 위한 작업 보조 데스크톱 애플리케이션입니다.
- 이 프로그램의 씬 데이터 기능은 [NAIS2](https://github.com/sunanakgo/NAIS2)와 함께 사용하는 것을 전제로 설계되었습니다.
- 이 프로그램은 생성형 AI로 제작된 리소스를 포함하고 있습니다.

## 🚀 주요 기능
### 🖼️ 이미지 태그 관련
- NovelAI로 생성한 이미지의 메타데이터(태그) 확인, 복사, 제거
- 이미지 확장자 일괄 변환
### 🎲 씬 프리셋 생성
- 랜덤 가중치 및 랜덤 출현 태그 씬 프리셋 생성
- 순차 블록의 모든 조합으로씬 프리셋 생성

### ✏️ 씬 데이터 편집
- NAIS2 씬 프리셋에 태그를 일괄 제거/대체/추가하여 편집

## 🛠 기술 스택
- **데스크톱 프레임워크**: Electron
- **프론트엔드**: React, Vite, TypeScript, Tailwind CSS / SCSS
- **백엔드**: Node.js (Electron 환경)
- **상태관리**: Zustand
- **이미지 처리**: sharp


## 📂 프로젝트 구조
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


## 📄 라이선스

> [GNU GPL-3.0 license](https://github.com/JZ-ZZANG/NTM/blob/main/LICENSE)


## 🙏 크레딧
- [novelai-image-metadata](https://github.com/NovelAI/novelai-image-metadata) - Novel Ai 공식 리포지토리. NAI로 생성된 이미지의 태그 관련 로직 참조
- [NAIS2](https://github.com/sunanakgo/NAIS2) - tags.json 데이터 및 씬 프리셋 json 데이터 구조 참조
