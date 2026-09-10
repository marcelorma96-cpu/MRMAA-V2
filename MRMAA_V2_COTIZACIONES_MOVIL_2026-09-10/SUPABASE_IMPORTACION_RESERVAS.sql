-- Ejecutar una sola vez para permitir que Invitados y Anticipo permanezcan
-- realmente vacíos cuando esas celdas estén en blanco en el archivo importado.

alter table public.v2_reservations
  alter column guests drop not null,
  alter column guests drop default,
  alter column deposit drop not null,
  alter column deposit drop default;

notify pgrst, 'reload schema';
