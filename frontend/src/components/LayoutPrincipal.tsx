import { ActionIcon, AppShell, Burger, Group, Image, NavLink, Text, Button, Badge, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IconCategory,
  IconDashboard,
  IconDatabase,
  IconFileTypePdf,
  IconFlask2,
  IconHistory,
  IconId,
  IconLogout,
  IconMoon,
  IconReportMedical,
  IconSettings,
  IconSun,
  IconUserCog,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '@/auth/AuthContext';
import { useConfiguracoes, useLogoUrl } from '@/api/configuracoes';

const ITENS_NAVEGACAO = [
  { rota: '/', rotulo: 'Painel', icone: IconDashboard, papeis: undefined },
  { rota: '/lancamentos', rotulo: 'Lançamentos', icone: IconReportMedical, papeis: undefined },
  {
    rota: '/relatorios',
    rotulo: 'Relatórios',
    icone: IconFileTypePdf,
    papeis: ['ADMIN', 'GESTOR'],
  },
  { rota: '/pacientes', rotulo: 'Pacientes', icone: IconUsers, papeis: undefined },
  { rota: '/exames', rotulo: 'Catálogo de Exames', icone: IconFlask2, papeis: ['ADMIN', 'GESTOR'] },
  { rota: '/especialidades', rotulo: 'Especialidades', icone: IconCategory, papeis: ['ADMIN', 'GESTOR'] },
  { rota: '/convenios', rotulo: 'Convênios', icone: IconId, papeis: ['ADMIN', 'GESTOR'] },
  { rota: '/usuarios', rotulo: 'Usuários', icone: IconUserCog, papeis: undefined },
  { rota: '/auditoria', rotulo: 'Auditoria', icone: IconHistory, papeis: ['ADMIN'] },
  { rota: '/backup', rotulo: 'Backup e Restauração', icone: IconDatabase, papeis: ['ADMIN', 'GESTOR'] },
  { rota: '/configuracoes', rotulo: 'Configurações', icone: IconSettings, papeis: ['ADMIN'] },
] as const;

export function LayoutPrincipal() {
  const [opened, { toggle }] = useDisclosure();
  const { usuario, sair, possuiPapel } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: config } = useConfiguracoes();
  const { data: logoUrl } = useLogoUrl(config?.temLogo ?? false);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {logoUrl ? (
              <Image src={logoUrl} h={32} w="auto" fit="contain" alt={config?.nomeClinica ?? 'Logo'} />
            ) : (
              <Text fw={700}>{config?.nomeClinica ?? 'Gestão de Exames'}</Text>
            )}
          </Group>
          <Group>
            <ActionIcon
              variant="subtle"
              onClick={() => toggleColorScheme()}
              title={colorScheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              aria-label="Alternar tema"
            >
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            {usuario && (
              <>
                <Badge variant="light">{usuario.papel}</Badge>
                <Text size="sm">{usuario.nome}</Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconLogout size={16} />}
                  onClick={() => {
                    sair();
                    navigate('/login');
                  }}
                >
                  Sair
                </Button>
              </>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {ITENS_NAVEGACAO.filter((item) => !item.papeis || possuiPapel(...item.papeis)).map((item) => (
          <NavLink
            key={item.rota}
            label={item.rotulo}
            leftSection={<item.icone size={18} />}
            active={location.pathname === item.rota}
            onClick={() => navigate(item.rota)}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
