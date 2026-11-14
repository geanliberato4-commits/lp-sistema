-- O login já existe: as funções de primeiro acesso ficam fechadas.
revoke execute on function public.sistema_configurado() from anon, authenticated, public;
