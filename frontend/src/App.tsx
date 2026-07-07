import { Navigate, Route, Routes } from 'react-router-dom';
import { LayoutPrincipal } from '@/components/LayoutPrincipal';
import { RotaProtegida } from '@/routes/RotaProtegida';
import { useAuth } from '@/auth/AuthContext';
import { LoginPage } from '@/pages/Login/LoginPage';
import { PainelPage } from '@/pages/Painel/PainelPage';
import { LancamentosPage } from '@/pages/Lancamentos/LancamentosPage';
import { RelatoriosPage } from '@/pages/Relatorios/RelatoriosPage';
import { PacientesPage } from '@/pages/Pacientes/PacientesPage';
import { ExamesPage } from '@/pages/Exames/ExamesPage';
import { EspecialidadesPage } from '@/pages/Especialidades/EspecialidadesPage';
import { ConveniosPage } from '@/pages/Convenios/ConveniosPage';
import { UsuariosPage } from '@/pages/Usuarios/UsuariosPage';
import { MeuPerfilPage } from '@/pages/MeuPerfil/MeuPerfilPage';
import { AuditoriaPage } from '@/pages/Auditoria/AuditoriaPage';
import { BackupPage } from '@/pages/Backup/BackupPage';
import { ConfiguracoesPage } from '@/pages/Configuracoes/ConfiguracoesPage';

/** ADMIN e GESTOR gerenciam todas as contas; TECNICO vê e mantém apenas o próprio cadastro. */
function UsuariosOuMeuPerfil() {
  const { possuiPapel } = useAuth();
  return possuiPapel('ADMIN', 'GESTOR') ? <UsuariosPage /> : <MeuPerfilPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RotaProtegida />}>
        <Route element={<LayoutPrincipal />}>
          <Route path="/" element={<PainelPage />} />
          <Route path="/lancamentos" element={<LancamentosPage />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/usuarios" element={<UsuariosOuMeuPerfil />} />

          <Route element={<RotaProtegida papeis={['ADMIN', 'GESTOR']} />}>
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/exames" element={<ExamesPage />} />
            <Route path="/especialidades" element={<EspecialidadesPage />} />
            <Route path="/convenios" element={<ConveniosPage />} />
          </Route>

          <Route element={<RotaProtegida papeis={['ADMIN']} />}>
            <Route path="/auditoria"     element={<AuditoriaPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>

          <Route element={<RotaProtegida papeis={['ADMIN', 'GESTOR']} />}>
            <Route path="/backup" element={<BackupPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
