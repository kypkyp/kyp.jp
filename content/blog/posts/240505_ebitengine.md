---
title: Ebitengineでビルドにアセットを埋め込む
date: "2024-05-05"
description:
---

Ebitengine で外部ファイルから画像を読み込む、`ebitenutil.NewImageFromFile()`という関数があります。  
描いた素材をそのまま使えるので、非常に便利なのですが、[ドキュメント](https://pkg.go.dev/github.com/hajimehoshi/ebiten/v2/ebitenutil#NewImageFromFile)には以下のような注意があります。

> How to solve path depends on your environment. This varies on your desktop or web browser. Note that this doesn't work on mobiles.  
> For productions, instead of using NewImageFromFile, it is safer to embed your resources with go:embed.

「パスの扱い方は環境によって変わるし、モバイル環境だと動作しない。本番では`go:embed`を使ったほうが安全だよ」とのこと。なるほど、早速試してみましょう。

#### embed.FS を使って外部ファイルをゲームに埋め込む

[`embed`パッケージのドキュメント](https://pkg.go.dev/embed)には、stringや[]byteなどに単体ファイルを埋め込む方法と、`embed.FS`を用いてディレクトリをまるっと読み込む方法が書かれています。  
ゲーム開発では、読み込む必要のあるアセットの数は膨大になるので、前者を使うのは現実的に厳しいでしょう。そこで、後者の `embed.FS` だけ使うことにします。
`embed.FS` と `ebitenutil.NewImageFromFileSystem` を組み合わせることで、外部ファイルから直接読み込むのと同じくらいの気軽さでバイナリ埋め込みを行うことが出来ます。

```go
//go:embed images/*
var images embed.FS

func load() {
  // ソースコードのある場所を起点として images/ui/background.png を ebiten.Image として読み込む
  img, _, err := ebitenutil.NewImageFromFileSystem(images, "ui/background.png")
}
```

ただし、ここで1つ注意があります。`embed.FS` で埋め込むことのできる外部ファイルの場所は、そのパッケージのあるディレクトリ内に制限されているということです。  
上記の例では、ソースコードのある場所のサブディレクトリにある画像を読み込みましたが、現実にはそのようなケースは少なく、以下のようにソースコードとアセットは分けて置かれていることがほとんどだと思います。

```
project/
　├ app/
　│ └ scenes/
　│   └ hoge.go
　└ assets/
　│ └ images/
　│   └ character.png
　└ main.go
```

このとき、`app/scenes/hoge.go` で以下のように書いたとしても、`assets/`以下のファイルを読み込むことはできません。（そもそも`../`とかが使えない）

```go
package hoge

import "embed"

//go:embed ../../assets/*
var assets embed.FS
```

どうするのか調べていたところ、[いい感じのGitHub上での回答](https://github.com/golang/go/issues/46056#issuecomment-1339401427)を見つけました。「アセットのあるディレクトリに新しいパッケージを作って、他のパッケージからimportして読み込め」ということです。  
例えば、上記の例だと、`project/assets/` の下に以下のようなパッケージを作ります。

```go
package assets

import "embed"

//go:embed *
var Assets embed.FS
```

```
project/
　├ app/
　│ └ scenes/
　│   └ hoge.go
　└ assets/
　│ └ assets.go ← NEW!
　│ └ images/
　│   └ character.png
　└ main.go
```

このパッケージをimportすることで、`project/app/` 以下のファイルからも `assets.Assets` として読み込むことができるというわけです。

#### 埋め込みと外部ファイル読み込みを切り替える

これで環境依存の少ないビルドが出来上がりました。  一件落着……かと思ったのですが、自分で`go:embed`を試したところ、ビルド時間が明らかに長くなっていました。プロジェクトの規模にもよるとは思うのですが、[現在開発中のゲーム](https://saekogame.com/)だとビルドのたびに10〜20秒かかってしまいます。

また、ビルドを変更すること無く、外部ファイルだけ差し替えたい需要は大きいと思います。アセットの見栄え確認やLQAなど、開発者以外にゲームを更新してもらう作業です。

そこで、外部ファイルの管理方法を、ビルド時埋め込みと起動時読み込みで切り替えられるようにします。この切り替えには[Goのbuild constraints](https://qiita.com/ssc-ynakamura/items/25e9d2f56ef5f1ca5fd0)を用います。

先ほどのプロジェクトの `assets/` 以下に、2つのファイルを設置します。

`assets_prod.go`

```go
//go:build prod

package assets

import (
	"embed"
)

//go:embed *
var Assets embed.FS
```

`assets_noprod.go`

```go
//go:build !prod

package assets

import (
	"os"
	"path/filepath"
)

// ちなみにmainからの相対パスになるので、テスト時に読み込むとパスがずれたりする。
// テストで使うならこういうのを使うと良さそう https://zenn.dev/tminamiii/articles/find-go-project-root
var Fs = os.DirFS("/assets")
```

これで通常時は実行時に外部ファイルを読み込むようにしつつ、リリース用のビルドを作る際だけ以下のようなタグ付けを行うことで、`go:embed` を用いた外部ファイル埋め込みを行うことができます。

```
$ go build -tags prod main.go
```
