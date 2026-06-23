# ComfyUI-List-Utils

[English](README.md)

ComfyUI で「複数の値を順番に処理する」「Python の list 値としてまとめて扱う」「型つきの値セットを受け渡す」ためのプリミティブなカスタムノード集です。

この拡張では、似ているけれど役割が違う 3 種類のコンテナを扱います。

| 名前 | 意味 | 主な用途 |
| --- | --- | --- |
| `List` | ComfyUI 公式の Data list / List processing | 複数の値を ComfyUI の逐次処理として流す |
| `PyList` | 生の Python `list` 値 | 値の配列を 1 つの値として保持・加工する |
| `Pack` | List-Utils 独自の、型情報つきコンテナ | 複数の異なる型の値をまとめて渡し、後で元の型で取り出す |

## Installation

`ComfyUI/custom_nodes` ディレクトリで clone して、ComfyUI を再起動してください。

```bash
git clone https://github.com/godmt/ComfyUI-List-Utils.git
```

ノードは `list_utils` カテゴリに追加されます。

## GUI Help

各ノードには ComfyUI 上で確認できる説明を追加しています。

- ノード自体の説明は、ノードにマウスを重ねたときの説明として表示されます。
- widget / input には、用途を説明する tooltip を追加しています。
- output には、何が出力されるかを説明する tooltip を追加しています。
- `Create List`、`Create PyList`、`Merge List`、`Merge PyList`、`Pack`、`Exec` の動的入力にも tooltip が付きます。

## List / PyList / Pack の使い分け

### List

`List` は ComfyUI の List processing 用です。たとえば 10 個の prompt、seed、画像、パスなどを順番に処理したいときに使います。

List-Utils の `List` 系ノードは、ComfyUI の `OUTPUT_IS_LIST` / `INPUT_IS_LIST` を使います。出力ソケットの型は `STRING`、`INT`、`IMAGE` など元の型として扱われます。

よく使う場面:

- 複数の文字列を 1 件ずつ downstream ノードへ流す
- `Create Range` で連番 seed を作る
- `List Dir` でファイルパスを列挙して順番に処理する
- `List: Get By Index` / `List: Slice` で ComfyUI List を取り出す

### PyList

`PyList` は Python の `list` そのものを 1 つの値として受け渡す型です。ComfyUI の逐次処理にはならず、配列をまとめたまま扱いたいときに使います。

よく使う場面:

- 文字列や数値の配列をまとめて保持する
- Python list として index / slice / merge / cast する
- `List To PyList` で ComfyUI List を 1 つの Python list にまとめる
- `PyList To List` で Python list を ComfyUI の逐次処理へ戻す

### Pack

`Pack` は複数の値を 1 本の `PACK` ソケットにまとめるためのコンテナです。各入力の値だけでなく、入力名と ComfyUI の型も保持します。

`Pack` / `Unpack` は、型の違う値をまとめて受け渡したいときに便利です。たとえば `MODEL`、`CLIP`、`VAE`、`CONDITIONING`、`IMAGE` のように、通常は 1 つの list に入れづらい値をまとめて運べます。

## Typical Workflows

### 文字列を分割して順番に処理する

1. `Split String` に複数行テキストや区切り文字つきテキストを入力します。
2. `STRING` 出力を使うと、ComfyUI の `List` として順番に流れます。
3. `PYLIST` 出力を使うと、Python list 値としてまとめて扱えます。
4. `length` 出力で要素数を取得できます。

### PyList を ComfyUI List に変換する

1. `Create PyList`、`Split String`、`Create Range` などで `PYLIST` を作ります。
2. `PyList To List` に接続します。
3. 出力は ComfyUI の `List` になり、下流で逐次処理できます。

逆に、ComfyUI の `List` を Python list としてまとめたい場合は `List To PyList` を使います。

### 複数の型をまとめて渡す

1. `Pack` に値を接続します。
2. 最後の空ソケットに接続すると、次の入力ソケットが自動で追加されます。
3. `Unpack` に接続すると、`Pack` 側の入力数と型に合わせて出力が作られます。

`Unpack` は一度 `Pack` に接続すると出力型を確定できます。`Switch` ノードや `Anything Everywhere` 系ノードを間に挟んだ構成でも、上流の `Pack` をたどれる場合は型を復元できます。

## Nodes

### Create / Generate

| Node | Output | Description |
| --- | --- | --- |
| `Split String` | `STRING` List, `PYLIST`, `length` | 文字列を delimiter または行で分割します。空要素は除去されます。 |
| `Create List` | `List` | 複数入力を ComfyUI List として作成します。 |
| `Create PyList` | `PYLIST` | 複数入力を Python list として作成します。 |
| `Create Range` | `INT` List, `PYLIST`, `length` | Python `range(start, stop, step)` で整数列を作ります。 |
| `Create Arange` | `FLOAT` List, `PYLIST`, `length` | `numpy.arange(start, stop, step)` で数値列を作ります。 |
| `Create Linspace` | `FLOAT` List, `PYLIST`, `length` | `numpy.linspace(start, stop, num)` で等間隔の数値列を作ります。 |
| `List Dir` | `STRING` List, `PYLIST`, `length` | 指定フォルダから `glob` pattern に一致する項目を列挙します。 |

### Merge / Convert

| Node | Output | Description |
| --- | --- | --- |
| `Merge List` | `List` | 複数の ComfyUI List を連結します。 |
| `Merge PyList` | `PYLIST` | 複数の PyList を連結します。 |
| `List To PyList` | `PYLIST` | ComfyUI List を Python list 値に変換します。 |
| `PyList To List` | `List` | PyList を ComfyUI List processing 用に展開します。 |

### Get / Slice

| Node | Output | Description |
| --- | --- | --- |
| `List: Get By Index` | item | ComfyUI List から指定 index の要素を取り出します。 |
| `PyList: Get By Index` | item | PyList から指定 index の要素を取り出します。 |
| `List: Slice` | `List` | ComfyUI List を `start:end` で切り出します。 |
| `PyList: Slice` | `PYLIST` | PyList を `start:end` で切り出します。 |

### Pack / Unpack

| Node | Output | Description |
| --- | --- | --- |
| `Pack` | `PACK` | 複数入力を、名前・型・値つきで 1 つの Pack にまとめます。 |
| `Unpack` | original types | Pack から元の値を取り出します。出力型は接続元の Pack に合わせて動的に変わります。 |

### Inspect / Utility

| Node | Output | Description |
| --- | --- | --- |
| `Get Length` | `INT` | `len(value)` を返し、ノード上にも表示します。 |
| `Get Shape` | `width`, `height`, `PyList_size`, `channels` | `IMAGE`、`LATENT`、`MASK` の形状を取得します。 |
| `Any To Dict` | `DICT`, `str()` | オブジェクトを dict または文字列に変換して確認します。 |
| `Get Widgets Values` | `LIST` | 接続元ノードの widget values を取得して表示します。 |
| `Any Cast` | selected type | 値を指定型として出力します。基本的な `STRING` / `INT` / `FLOAT` / `BOOLEAN` 変換にも使えます。 |
| `PyList Item Cast` | `PYLIST` | PyList 内の各要素を `STRING` / `INT` / `FLOAT` / `BOOLEAN` などへ変換します。 |
| `Exec` | any | 入力値 `x[0]`, `x[1]`, ... を使って Python コードを実行し、`result` を返します。 |

## Dynamic Inputs

一部のノードは入力ソケットを動的に増やします。

- `Create List`
- `Create PyList`
- `Merge List`
- `Merge PyList`
- `Pack`
- `Exec`

最後の空ソケットに接続すると次のソケットが追加されます。接続を外すと未使用ソケットは整理されます。

`Create List` / `Merge List` は、最初に接続した入力の型に合わせて出力型が変わります。`Pack` は入力ごとの型を保持します。

## Notes

- `List` と `PyList` は別物です。接続できない、または期待どおりに逐次処理されない場合は `List To PyList` / `PyList To List` で変換してください。
- `List: Get By Index` と `PyList: Get By Index` は、index が範囲外の場合 `None` を返します。
- Python の slice と同じく、`start:end` の `end` は含まれません。
- `Exec` は任意の Python コードを実行します。信頼できる workflow でだけ使ってください。

## Example

![Example workflow](https://github.com/user-attachments/assets/d1543cf3-84db-4b94-b326-88d48f46bd49)
