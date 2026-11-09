DROP TABLE IF EXISTS state_history;
DROP TABLE IF EXISTS prefecture_states;
DROP TABLE IF EXISTS editors;
DROP TABLE IF EXISTS statuses;
DROP TABLE IF EXISTS prefectures;

CREATE TABLE prefectures (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 47),
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL CHECK (length(color) = 7 AND substr(color, 1, 1) = '#'),
  sort_order INTEGER NOT NULL,
  counts_as_visited INTEGER NOT NULL DEFAULT 0 CHECK (counts_as_visited IN (0, 1))
);

CREATE TABLE editors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE prefecture_states (
  prefecture_id INTEGER PRIMARY KEY REFERENCES prefectures(id),
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES editors(id)
);

CREATE TABLE state_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefecture_id INTEGER NOT NULL REFERENCES prefectures(id),
  from_status_id INTEGER REFERENCES statuses(id),
  to_status_id INTEGER NOT NULL REFERENCES statuses(id),
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by INTEGER REFERENCES editors(id)
);

CREATE INDEX idx_history_pref ON state_history (prefecture_id, changed_at);

INSERT INTO statuses (code, label, color, sort_order, counts_as_visited) VALUES
  ('visited', '行った', '#d7262e', 1, 1),
  ('next', '次に行く', '#1f5fbf', 2, 0),
  ('none', 'まだ', '#ffffff', 3, 0);

INSERT INTO prefectures (id, name, region, sort_order) VALUES
  (1,'北海道','北海道・東北',1),(2,'青森県','北海道・東北',2),(3,'岩手県','北海道・東北',3),(4,'宮城県','北海道・東北',4),
  (5,'秋田県','北海道・東北',5),(6,'山形県','北海道・東北',6),(7,'福島県','北海道・東北',7),
  (8,'茨城県','関東',8),(9,'栃木県','関東',9),(10,'群馬県','関東',10),(11,'埼玉県','関東',11),
  (12,'千葉県','関東',12),(13,'東京都','関東',13),(14,'神奈川県','関東',14),
  (15,'新潟県','中部',15),(16,'富山県','中部',16),(17,'石川県','中部',17),(18,'福井県','中部',18),
  (19,'山梨県','中部',19),(20,'長野県','中部',20),(21,'岐阜県','中部',21),(22,'静岡県','中部',22),(23,'愛知県','中部',23),
  (24,'三重県','近畿',24),(25,'滋賀県','近畿',25),(26,'京都府','近畿',26),(27,'大阪府','近畿',27),
  (28,'兵庫県','近畿',28),(29,'奈良県','近畿',29),(30,'和歌山県','近畿',30),
  (31,'鳥取県','中国',31),(32,'島根県','中国',32),(33,'岡山県','中国',33),(34,'広島県','中国',34),(35,'山口県','中国',35),
  (36,'徳島県','四国',36),(37,'香川県','四国',37),(38,'愛媛県','四国',38),(39,'高知県','四国',39),
  (40,'福岡県','九州・沖縄',40),(41,'佐賀県','九州・沖縄',41),(42,'長崎県','九州・沖縄',42),(43,'熊本県','九州・沖縄',43),
  (44,'大分県','九州・沖縄',44),(45,'宮崎県','九州・沖縄',45),(46,'鹿児島県','九州・沖縄',46),(47,'沖縄県','九州・沖縄',47);

INSERT INTO prefecture_states (prefecture_id, status_id)
  SELECT p.id, CASE p.id
    WHEN 22 THEN (SELECT id FROM statuses WHERE code = 'visited')
    WHEN 35 THEN (SELECT id FROM statuses WHERE code = 'next')
    ELSE (SELECT id FROM statuses WHERE code = 'none') END
  FROM prefectures p;

SELECT p.name, s.label, s.color FROM prefecture_states ps
  JOIN prefectures p ON p.id = ps.prefecture_id
  JOIN statuses s ON s.id = ps.status_id
  WHERE s.code <> 'none';
