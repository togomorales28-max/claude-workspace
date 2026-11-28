-- Los visitantes anónimos no necesitan saber si son dueños.
revoke execute on function public.cotizador_is_owner() from anon;
grant execute on function public.cotizador_is_owner() to authenticated;
