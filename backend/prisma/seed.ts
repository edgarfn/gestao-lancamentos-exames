import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

/**
 * Script de seed — cria um usuário ADMIN inicial e um catálogo básico de
 * exames. Não insere pacientes/técnicos fictícios com dados reais: em
 * ambientes de desenvolvimento, gere massa de dados sintética separadamente.
 *
 * As credenciais do admin inicial são geradas aleatoriamente e impressas
 * UMA VEZ no console — devem ser trocadas no primeiro acesso.
 */

const prisma = new PrismaClient();

function deriveEncryptionKey(): Buffer {
  const rawKey = process.env.DATA_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('DATA_ENCRYPTION_KEY não configurada — defina no .env antes de rodar o seed.');
  }
  return createHash('sha256').update(rawKey).digest().subarray(0, 32);
}

function searchHash(value: string): string {
  const key = deriveEncryptionKey();
  return createHash('sha256').update(key).update(value.trim().toLowerCase()).digest('hex');
}

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@exames.local';
  const existingAdmin = await prisma.usuario.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const generatedPassword = randomBytes(18).toString('base64url');
    const senhaHash = await argon2.hash(generatedPassword, { type: argon2.argon2id });

    await prisma.usuario.create({
      data: {
        nome: 'Administrador',
        email: adminEmail,
        senhaHash,
        papel: 'ADMIN',
      },
    });

    // eslint-disable-next-line no-console
    console.log('================================================================');
    console.log(' Usuário administrador criado.');
    console.log(` E-mail: ${adminEmail}`);
    console.log(` Senha temporária (anote agora — não será exibida novamente):`);
    console.log(`   ${generatedPassword}`);
    console.log(' >>> Troque esta senha imediatamente após o primeiro login. <<<');
    console.log('================================================================');
  } else {
    // eslint-disable-next-line no-console
    console.log(`Usuário admin "${adminEmail}" já existe — nada a fazer.`);
  }

  const catalogoExames: Array<{ nome: string; codigo: string; valorPadrao: string }> = [
    { nome: 'Hemograma Completo', codigo: 'HEMO001', valorPadrao: '45.00' },
    { nome: 'Glicemia em Jejum', codigo: 'GLIC001', valorPadrao: '25.00' },
    { nome: 'Colesterol Total e Frações', codigo: 'COLT001', valorPadrao: '60.00' },
    { nome: 'Urinálise (EAS)', codigo: 'URIN001', valorPadrao: '30.00' },
    { nome: 'Raio-X de Tórax', codigo: 'RXTX001', valorPadrao: '120.00' },
    { nome: 'Eletrocardiograma (ECG)', codigo: 'ECG0001', valorPadrao: '90.00' },
    { nome: 'Ultrassonografia Abdominal', codigo: 'USAB001', valorPadrao: '180.00' },
  ];

  for (const exame of catalogoExames) {
    await prisma.exame.upsert({
      where: { codigo: exame.codigo },
      update: {},
      create: exame,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Catálogo de exames verificado/criado (${catalogoExames.length} itens).`);

  void searchHash; // mantém a função disponível para extensões futuras de seed com dados sintéticos
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
