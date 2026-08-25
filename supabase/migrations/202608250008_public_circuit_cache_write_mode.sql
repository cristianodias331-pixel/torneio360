begin;

-- A primeira abertura após uma invalidação pode reconstruir o snapshot. Por
-- isso o RPC externo não pode forçar uma transação somente de leitura.
alter function public.get_public_circuit_with_tournaments(uuid) volatile;

commit;
