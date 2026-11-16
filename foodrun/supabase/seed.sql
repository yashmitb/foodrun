-- Seed: UCSD halls, stations and destinations.
--
-- Generated from foodrun-context/data/ucsd_dining.json, which carries
-- verify flags for the facts that still need checking against HDH. Station
-- lists change every year, so this is upsert-shaped: re-running it updates
-- names and hours without disturbing runs that already reference a hall.

insert into public.halls (id, name, college, triton2go, hours, active) values
  ('64-degrees', '64 Degrees', 'Revelle', true, '{"sun": "9am-9pm", "mon": "7am-11pm", "tue": "7am-11pm", "wed": "7am-11pm", "thu": "7am-11pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('pines', 'Pines', 'Muir', true, '{"sun": "9am-11pm", "mon": "7am-11pm", "tue": "7am-11pm", "wed": "7am-11pm", "thu": "7am-11pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('canyon-vista', 'Canyon Vista', 'Warren', true, '{"sun": "9am-9pm", "mon": "7am-9pm", "tue": "7am-9pm", "wed": "7am-9pm", "thu": "7am-9pm", "fri": "7am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('ventanas', 'Ventanas', 'Eighth', true, '{"sun": "9am-9pm", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-9pm", "sat": "9am-9pm"}'::jsonb, true),
  ('oceanview', 'OceanView', 'Marshall', true, '{"sun": "closed", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-3pm", "sat": "closed"}'::jsonb, true),
  ('sixth', 'Restaurants at Sixth', 'Sixth', true, '{"sun": "closed", "mon": "8am-9pm", "tue": "8am-9pm", "wed": "8am-9pm", "thu": "8am-9pm", "fri": "8am-9pm", "sat": "closed"}'::jsonb, true),
  ('foodworx', 'Foodworx', null, true, '{"sun": "closed", "mon": "9am-8pm", "tue": "9am-8pm", "wed": "9am-8pm", "thu": "9am-8pm", "fri": "9am-8pm", "sat": "closed"}'::jsonb, true)
on conflict (id) do update set
  name = excluded.name,
  college = excluded.college,
  triton2go = excluded.triton2go,
  hours = excluded.hours,
  active = excluded.active;

insert into public.restaurants (hall_id, name, sort) values
  ('64-degrees', 'Garden Bar', 0),
  ('64-degrees', 'Taqueria', 1),
  ('64-degrees', 'Triton Grill', 2),
  ('64-degrees', 'Wok This Way', 3),
  ('pines', 'Char', 0),
  ('pines', 'Heat', 1),
  ('pines', 'Current', 2),
  ('pines', 'Breeze', 3),
  ('pines', 'Street Eats', 4),
  ('pines', 'Pacific Coast Hwy', 5),
  ('pines', 'Morning Fog', 6),
  ('pines', 'Slice at Pines', 7),
  ('canyon-vista', '360', 0),
  ('canyon-vista', 'Fresh', 1),
  ('canyon-vista', 'Fusion Grill', 2),
  ('ventanas', 'Soul', 0),
  ('ventanas', 'Tandoor', 1),
  ('ventanas', 'Vibe', 2),
  ('ventanas', 'Journey', 3),
  ('ventanas', 'HaPi', 4),
  ('ventanas', 'Kaldi', 5),
  ('oceanview', 'Journey Bowls', 0),
  ('oceanview', 'Tandoor', 1),
  ('oceanview', 'Vibe', 2),
  ('oceanview', 'Soul', 3),
  ('oceanview', 'Burgers', 4),
  ('oceanview', 'Build Your Own', 5)
on conflict (hall_id, name) do update set sort = excluded.sort, active = true;

insert into public.destinations (id, name) values
  ('geisel', 'Geisel Library'),
  ('price-center', 'Price Center'),
  ('biomed-library', 'Biomedical Library'),
  ('cse-building', 'CSE Building'),
  ('revelle-res', 'Revelle residence lobbies'),
  ('muir-res', 'Muir residence lobbies'),
  ('warren-res', 'Warren residence lobbies'),
  ('marshall-res', 'Marshall residence lobbies'),
  ('sixth-res', 'Sixth residence lobbies'),
  ('eighth-res', 'Eighth residence lobbies')
on conflict (id) do update set name = excluded.name;

-- A few real drop spots so the "No sticker? Pick a spot" fallback (§6.3)
-- has something to offer before any QR stickers exist.
insert into public.drop_spots (destination_id, label) values
  ('geisel', 'Geisel 1F, Lobby'),
  ('geisel', 'Geisel 2F, Table 14'),
  ('geisel', 'Geisel 8F, East window'),
  ('price-center', 'Price Center, Lobby'),
  ('price-center', 'Price Center, Front desk'),
  ('biomed-library', 'Biomedical Library, Lobby'),
  ('biomed-library', 'Biomedical Library, Front desk'),
  ('cse-building', 'CSE Building, Lobby'),
  ('cse-building', 'CSE Building, Front desk'),
  ('revelle-res', 'Revelle residence lobbies, Lobby'),
  ('revelle-res', 'Revelle residence lobbies, Front desk'),
  ('muir-res', 'Muir residence lobbies, Lobby'),
  ('muir-res', 'Muir residence lobbies, Front desk'),
  ('warren-res', 'Warren residence lobbies, Lobby'),
  ('warren-res', 'Warren residence lobbies, Front desk'),
  ('marshall-res', 'Marshall residence lobbies, Lobby'),
  ('marshall-res', 'Marshall residence lobbies, Front desk'),
  ('sixth-res', 'Sixth residence lobbies, Lobby'),
  ('sixth-res', 'Sixth residence lobbies, Front desk'),
  ('eighth-res', 'Eighth residence lobbies, Lobby'),
  ('eighth-res', 'Eighth residence lobbies, Front desk')
on conflict (destination_id, label) do nothing;
