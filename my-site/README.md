# 全国マーケティング旅（Cloudflare Pages）

```
my-site/
├── index.html          (トップ画面＝LP)
├── admin.html          (編集画面：/admin で開く)
├── style.css
├── js/
│   ├── map.js          (地図の描画・県名)
│   ├── data.js         (色データの読み込み)
│   ├── lp.js           (トップ画面の動き)
│   └── admin.js        (編集画面の動き)
├── functions/
│   └── api/
│       └── db.js       (DB接続：env.DB.prepare … ／ URLは /api/db)
└── db/
    └── schema.sql      (D1のConsoleに貼るSQL。作成済みなら不要)
```

## Cloudflare Pages の設定（最初の1回）

GitHub のリポジトリに上の構成で置き、Pages のプロジェクトとつなぎます。
ビルドの設定は「フレームワーク：なし」、ビルドコマンドは空欄、出力ディレクトリは `/` です。

### 1. D1 をつなぐ
Pages プロジェクトの「設定」→「バインディング」→「追加」→「D1 データベース」
- 変数名：`DB`
- データベース：`marketing-trip`

### 2. 編集できる人を登録する
D1 の「Console」で実行します（複数人なら1人ずつ）。
```sql
INSERT INTO editors (name, email) VALUES ('自分の名前', 'メールアドレス');
```

### 3. 編集画面を Cloudflare Access で守る
1. 「Zero Trust」→「Access」→「Applications」→「Add an application」→「Self-hosted」
2. サイトのドメインと、パス `admin` を登録する
3. ポリシーで「Emails」に、手順2のメールアドレスを入れる
4. 作成後に表示される「AUD タグ」と、Zero Trust のチーム名を控える

### 4. 環境変数を入れる
Pages プロジェクトの「設定」→「変数とシークレット」
- `ACCESS_TEAM_DOMAIN` … `https://（チーム名）.cloudflareaccess.com`
- `ACCESS_AUD` … 手順3で控えた AUD タグ

設定を変えたら、もう一度デプロイ（GitHub に push か、「デプロイを再試行」）してください。

## 使い方
- トップ画面：`https://（サイトのURL）/`
- 編集画面：`https://（サイトのURL）/admin`

編集画面で Access にログインし、「行った／次に行く／まだ」から色を選んで県をタップすると、
すぐ D1 に保存されてトップ画面に反映されます。同じ色の県をもう一度タップすると「まだ」に戻ります。

`/api/db` はトップ画面が色を読むために公開しています。色の変更は、
/admin でログインした人（editors に登録済み）だけができます。
