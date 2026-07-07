import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

describe('AuditoriaController', () => {
  let service: Partial<Record<keyof AuditoriaService, jest.Mock>>;
  let controller: AuditoriaController;

  beforeEach(() => {
    service = {
      listar: jest
        .fn()
        .mockResolvedValue({ itens: [], total: 0, pagina: 1, tamanhoPagina: 20, totalPaginas: 1 }),
      listarEntidades: jest.fn().mockResolvedValue(['Lancamento', 'Tecnico']),
    };
    controller = new AuditoriaController(service as unknown as AuditoriaService);
  });

  it('listar repassa o DTO de filtros ao serviço', async () => {
    const query = {
      usuarioId: 'user-1',
      acao: 'ATUALIZACAO',
      pagina: 1,
      tamanhoPagina: 20,
    } as QueryAuditoriaDto;

    await controller.listar(query);

    expect(service.listar).toHaveBeenCalledWith(query);
  });

  it('listarEntidades delega ao serviço sem parâmetros', async () => {
    const resultado = await controller.listarEntidades();

    expect(service.listarEntidades).toHaveBeenCalledWith();
    expect(resultado).toEqual(['Lancamento', 'Tecnico']);
  });
});
