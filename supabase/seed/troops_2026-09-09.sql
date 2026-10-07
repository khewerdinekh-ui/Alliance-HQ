-- Alliance HQ — one-off fill of the Troops tab from the alliance sheet
-- (screenshots dated 9/9/26). Matches members by name (current members only)
-- and stamps "last updated" as 9/9/26. Rows that already exist in Troops are
-- left alone (on conflict do nothing), so nothing already edited is overwritten.
-- Blank cells in the sheet are blank here.
-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run.

insert into troops (org_id, member_id, infantry, lancers, marksmen, updated_at)
select m.org_id, m.id, v.i, v.l, v.m, '2026-09-09 12:00:00+00'::timestamptz
from (values
('_Kieran','','',''),('404 Not Found','T12(10)','T11(10)','T11(10)'),('Acemi','','',''),('AKAZA','T11(9)','T11(9)','T11(9)'),('Almila','','',''),
('Alucard','T11(10)','T11(10)','T12(10)'),('ARS44','T11(10)','T11(10)','T12(10)'),('Baran','','',''),('Bender','T11(10)','T11(10)','T12(10)'),('Benettino','','',''),
('BlackMambaxxl','T11(10)','N(9)','N(10)'),('BlossomBerry','','',''),('Bratko','T11(9)','T11(9)','T11(9)'),('Camille','','',''),('Caterina','T11(10)','T11(10)','T11(10)'),
('Champsdawk95','','',''),('Chief247','','',''),('Count Doom','T11(9)','T11(9)','T11(9)'),('csenn','T11(9)','T11(9)','T11(9)'),('Damon963','T11(10)','T11(10)','T12(10)'),
('Darkoso','N(8)','N(7)','N(9)'),('DARTH eSTAR','T11(9)','T11(9)','T11(9)'),('DARTH LORD','T11(10)','T11(10)','T11(9)'),('DerSchakal','T11(9)','T11(9)','T11(10)'),
('DiveJim','','',''),('DOS','T12(10)','T12(10)','T12(10)'),('ElyG','T11(10)','T11(10)','T11(10)'),('Firefly!','T11(10)','T11(10)','T11(10)'),('Gdub35','T11(9)','T11(9)','T11(9)'),
('Gerhard','T11(10)','N(10)','N(9)'),('Gesco','','',''),('Giugg&Tak','T11(10)','T11(10)','T11(10)'),('GOAT','T12(10)','T11(10)','T12(10)'),('GoldenLionKing','','',''),
('GOON','T11(9)','T11(9)','T11(9)'),('Guerreirolsraei','T11(10)','T11(10)','T11(10)'),('Guy','','',''),('HappyMeme','','',''),('Ice','T11(9)','T11(9)','T11(9)'),
('Igor_X','N(7)','N(7)','N(7)'),('Imba','','',''),('Jaimoso','','',''),('JeY','','',''),('Jona','T11(9)','T11(9)','T11(9)'),('Julie','','',''),
('Karina','T11(10)','T11(10)','T12(10)'),('Kathryita','','',''),('King Lionardo','','',''),('Laya','N(8)','N(8)','N(8)'),('Legolas Turco','','',''),('Liaohuwen','','',''),
('LilShanora','N(5)','N(5)','N(6)'),('Lonewolf420','T12(10)','T11(10)','T11(10)'),('Lord Beano','T11(10)','N(9)','T11(10)'),('Lord Tyrion','','',''),('LUNA','T11(9)','T11(9)','T11(9)'),
('Markus Oreallyus','T11(10)','T11(10)','T11(10)'),('Medoo','T11(10)','N(9)','T12(10)'),('mirdes','','',''),('MITCH','','',''),('Mowgli','T12(10)','T11(10)','T12(10)'),
('MrFabulous','T11(10)','T11(10)','T11(10)'),('MrZaid','T11(10)','T11(10)','T11(10)'),('Music','','',''),('Nefri','N(8)','N(7)','N(9)'),('newlord','','',''),('NZT48','','',''),
('Obeie1','','',''),('PANTA','','',''),('Pejski','T12(10)','T12(10)','T12(10)'),('RAED','T11(10)','T11(10)','T12(10)'),('RajSeyNaagar','T11(9)','T11(9)','T11(9)'),
('Rookie','T12(10)','T12(10)','T12(10)'),('Sasha','T11(10)','T11(9)','T11(9)'),('Schafs','T11(10)','T11(10)','T11(10)'),('Scorpion Polska','N(9)','N(9)','N(10)'),
('Sharmame','T11(10)','T11(9)','T11(9)'),('SheF85','T11(9)','T11(9)','T11(9)'),('Sigyn','T11(10)','T11(10)','T11(10)'),('Silk','T11(10)','N(10)','T11(10)'),
('Skoden','T11(9)','T11(9)','T11(9)'),('SourabhG','N(10)','N(9)','N(9)'),('Sunraku','T11(10)','T11(10)','T12(10)'),('Sunraku Jr','','',''),('SWOOP','','',''),('Swurve','','',''),
('Sylvinho94','T12(9)','T11(9)','T11(9)'),('Targetman','','',''),('Timm','','',''),('TinyM16','','',''),('Toasty','T11(10)','T11(10)','T11(10)'),('tof','','',''),('Tormund','','',''),
('Uncle Haiyaa','T11(9)','N(9)','T11(9)'),('Visiolous','','',''),('WaBi','','',''),('Wilcho','T11(10)','T11(10)','T11(10)'),('Wolf Law Cro','T11(10)','T11(10)','T11(10)')
) as v(name, i, l, m)
join lateral (
  select * from members mm
  where lower(mm.name) = lower(v.name) and mm.status = 'current'
  order by mm.created_at
  limit 1
) m on true
on conflict (member_id) do nothing;

-- Optional check afterwards: names from the sheet that did NOT match a current member.
-- (Run separately; paste the same list of names into the values below.)
