import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import TitleBar from './components/layout/TitleBar';
import SideBar from './components/layout/SideBar';
import Home from './pages/Home';
import Settings from './pages/Settings';
import TagViewer from './pages/TagViewer';
import TagDiff from './pages/TagDiff/TagDiff';
import TagRemover from './pages/TagRemover';
import RandomWeight from './pages/SceneData/RandomWeight';
import ScenePresetBatch from './pages/SceneData/ScenePresetBatch';
import ScenePresetEdit from './pages/SceneData/ScenepresetEdit';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <TitleBar />
        <div className="body-container">
          <SideBar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tag-viewer" element={<TagViewer />} />
              <Route path="/tag-diff" element={<TagDiff />} />
              <Route path="/tag-remover" element={<TagRemover />} />
              <Route path="/random-weight" element={<RandomWeight />} />
              <Route path="/scene-preset-batch" element={<ScenePresetBatch />} />
              <Route path="/scene-preset-edit" element={<ScenePresetEdit />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;