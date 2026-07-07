export type Papel = 'ADMIN' | 'GESTOR' | 'TECNICO';

export type AcaoAuditoria =
  | 'CRIACAO'
  | 'LEITURA'
  | 'ATUALIZACAO'
  | 'EXCLUSAO'
  | 'EXPORTACAO'
  | 'LOGIN'
  | 'LOGIN_FALHO'
  | 'ANONIMIZACAO'
  | 'BACKUP_CRIACAO'
  | 'BACKUP_RESTAURACAO'
  | 'BACKUP_EXCLUSAO';

export interface RegistroAuditoria {
  id: string;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId: string | null;
  operador: { id: string; nome: string; email: string } | null;
  dadosAntigos: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  enderecoIp: string | null;
  enderecoIpProxy: string | null;
  userAgent: string | null;
  criadoEm: string;
}

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  tecnicoId?: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  ultimoLoginEm: string | null;
  criadoEm: string;
  tecnico?: { registroProfissional: string | null } | null;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
}

export interface Tecnico {
  id: string;
  nome: string;
  registroProfissional: string | null;
  ativo: boolean;
}

export interface Paciente {
  id: string;
  nome: string;
  dataNascimento: string | null;
  contato: string | null;
  anonimizado: boolean;
}

export interface Especialidade {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Convenio {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Exame {
  id: string;
  nome: string;
  codigo: string;
  valorPadrao: string;
  ativo: boolean;
  especialidade?: { id: string; nome: string } | null;
}

export interface Lancamento {
  id: string;
  data: string;
  quantidade: number;
  valor: string;
  observacoes: string | null;
  tecnico: { id: string; nome: string };
  paciente: { id: string; nome: string };
  exame: { id: string; nome: string; codigo: string; especialidade: { id: string; nome: string } | null };
  convenio: { id: string; nome: string } | null;
  criadoEm: string;
}

export interface ResumoLancamentos {
  totalRegistros: number;
  quantidadeTotal: number;
  valorTotal: string;
}

export interface PontoEvolucaoMensal {
  mes: string;
  rotulo: string;
  faturamento: string;
  quantidade: number;
}

export interface BackupArquivo {
  nome: string;
  tamanhoBytes: number;
  criadoEm: string;
  criptografado: boolean;
}

export interface Configuracao {
  nomeClinica: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  emailContato: string | null;
  temLogo: boolean;
  mensagemBemVindo: string | null;
}
