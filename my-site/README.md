# 全国マーケティング旅（Cloudflare Workers）

```
my-site/
├── index.html          (トップ画面＝LP)
├── admin.html          (編集画面：/admin で開く)
├── style.css
├── js/                 (地図・画面の動き)
├── functions/
│   └── api/
│       └── db.js       (DB接続：env.DB.prepare … ／ URLは /api/db)
├── worker.js           (Workers の入口：/api/db を db.js に渡す)
├── wrangler.jsonc      (Workers の設定：D1・Access)
├── .assetsignore       (公開しないファイルの一覧)
└── db/schema.sql       (D1のConsoleに貼るSQL。作成済みなら不要)
```

Workers では `functions` フォルダは自動では動かないため、`worker.js` から `db.js` を呼び出しています。
`functions`・`worker.js`・`db` などは `.assetsignore` で公開しないようにしています。

## 最初の設定

### 1. wrangler.jsonc を書き換える
- `name` … ダッシュボードにある Worker の名前
- `database_id` … D1 のデータベース画面に出ている ID
- `ACCESS_TEAM_DOMAIN`・`ACCESS_AUD` … 手順3で控えた値

D1 のバインディングはこのファイルに書いてあるので、ダッシュボードで追加する必要はありません。

### 2. 編集できる人を登録する
D1 の「Console」で実行します（複数人なら1人ずつ）。
```sql
INSERT INTO editors (name, email) VALUES ('自分の名前', 'メールアドレス');
```

### 3. 編集画面を Cloudflare Access で守る
1. 「Zero Trust」→「Access」→「Applications」→「Add an application」→「Self-hosted」
2. サイトのドメインと、パス `admin` を登録する
3. ポリシーで「Emails」に、手順2のメールアドレスを入れる
4. 作成後に表示される「AUD タグ」と、Zero Trust のチーム名を控えて、手順1のファイルに入れる

workers.dev のURLで使う場合は、Worker の設定で workers.dev に Cloudflare Access を有効にしてください。

### 4. GitHub に push する
リポジトリの一番上に `wrangler.jsonc` と `index.html` が並ぶように置き、push すると自動でデプロイされます。

## 使い方
- トップ画面：`https://（サイトのURL）/`
- 編集画面：`https://（サイトのURL）/admin`

編集画面で Access にログインし、「行った／次に行く／まだ」から色を選んで県をタップすると、
すぐ D1 に保存されてトップ画面に反映されます。同じ色の県をもう一度タップすると「まだ」に戻ります。

## 動いているかの確認
`https://（サイトのURL）/api/db` を開いて、`{"updated":…` のような文字が出ればデータベースにつながっています。
