-- Seed de desenvolvimento - VOIA APP
--
-- Dados exclusivamente fictícios para uso local/dev.
-- NUNCA aplicar este arquivo em produção. Ele não é executado
-- automaticamente por nenhum script; aplique manualmente apenas em
-- bancos D1 locais de desenvolvimento (veja README.md).
--
-- Depende da migration 0001_init_base.sql já ter sido aplicada
-- (usa o usuário admin@voia.local criado nela).

-- Usuários fictícios adicionais
INSERT INTO usuarios (nome, email, perfil, ativo) VALUES
	('Gestora Exemplo', 'gestor@voia.local', 'gestor', 1),
	('Engenheiro Exemplo', 'engenheiro@voia.local', 'engenheiro', 1);

-- Organizações fictícias (uma PJ, uma PF)
INSERT INTO organizacoes (tipo, nome, nome_fantasia, documento, email, telefone) VALUES
	('PJ', 'Engenharia Exemplo Ltda', 'Exemplo Engenharia', '00000000000191', 'contato@exemplo-engenharia.test', '(00) 0000-0000'),
	('PF', 'Cliente Exemplo da Silva', NULL, '00000000000', 'cliente.exemplo@correio.test', '(00) 00000-0000');

-- Projetos fictícios vinculados às organizações acima
INSERT INTO projetos (organizacao_id, nome, descricao, status, gerente_id, criado_por_id) VALUES
	(
		(SELECT id FROM organizacoes WHERE documento = '00000000000191'),
		'Projeto de Exemplo - Reforma Industrial',
		'Projeto fictício usado apenas para validar a fundação do VOIA APP.',
		'em_andamento',
		(SELECT id FROM usuarios WHERE email = 'gestor@voia.local'),
		(SELECT id FROM usuarios WHERE email = 'admin@voia.local')
	),
	(
		(SELECT id FROM organizacoes WHERE documento = '00000000000'),
		'Projeto de Exemplo - Consultoria Residencial',
		'Projeto fictício usado apenas para validar a fundação do VOIA APP.',
		'planejamento',
		(SELECT id FROM usuarios WHERE email = 'engenheiro@voia.local'),
		(SELECT id FROM usuarios WHERE email = 'admin@voia.local')
	);
