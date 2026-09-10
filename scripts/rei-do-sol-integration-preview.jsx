import '../src/style.css';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from '../src/features/reiDoSol/ReiDoSolWorkspace.jsx';
import { createInitialData } from '../src/domain/tournamentDataNormalization.mjs';
import { modalityConfig } from '../src/domain/modalityConfig.mjs';
import { applyReiDoSolState } from '../src/domain/reiDoSolData.mjs';
import { makeExample } from '../src/domain/reiDoSol.mjs';
const params = new URLSearchParams(location.search);
const initial = createInitialData('Rei do Sol', modalityConfig['Rei do Sol']);
const fixture = params.has('scenario') ? applyReiDoSolState(initial, makeExample(20, 4, params.get('scenario'))) : initial;
document.documentElement.dataset.theme = params.get('theme') || 'dark';
function IntegrationPreview() {
  const [data, update] = useState(fixture);
  const current = useRef(data);
  const setData = (value) => { const next = typeof value === 'function' ? value(current.current) : value; current.current = next; update(next); };
  return <div className="proDashboard playAppShell"><main className="playMain"><div className="tournamentWorkspaceContent">
    <p role="note">Teste local da integração · sem gravação na nuvem</p>
    <Workspace data={data} setData={setData} tournament={{ name: 'Rei do Sol · teste da integração', type: 'Rei do Sol' }} readOnly={params.has('public')} savingBadge={<span>Somente teste local</span>} />
  </div></main></div>;
}
createRoot(document.getElementById('root')).render(<IntegrationPreview />);
