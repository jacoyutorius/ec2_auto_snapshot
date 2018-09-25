# EC2 AutoSnapshot

AWS Lambda / CloudWatch Events を使用してバックアップ対象の EC2 のスナップショットを作成する。

## 事前準備

[SAM CLI のインストール](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/sam-cli-requirements.html)

※Lambda と全く環境で動かす場合には Docker もインストールしておく。
ただし、今回のスクリプト自体は Lambda には依存しないため、ローカルで動作確認することも可能。
その場合は各 app.js の一番下の行の"execute local"のコメントアウトを外して"node app.js"を実行する。

1.  sam cli のインストール
2.  aws cli のインストール
3.  _auto_snapshot"の credential の登録

```
aws configure --profile_auto_snapshot
```

```
cp template.yaml template_production.yaml
# template_production.yamlに<YOUR ACCESS KEY>, <YOUR SECRET ACCESS KEY>を設定する
```

## Function

### AutoSnapshotFunction

タグに「SnapshotGeneration」が含まれている EC2 のスナップショットを取得する。

### DeleteSnapshotFunction

AutoSnapshotFunction にて取得されたスナップショットが規定数を上回った場合に、作成日時の古いものから削除する。
スナップショットのタグに「AutoSnapshot」が含まれているもののみが削除対象。
**保存しておくスナップショットの数は EC2 の"SnapshotGeneration"タグの値ではなく、app.js に定義された"snapshotMaxCount"の値による。**

## CloudWatch Events

```yaml
Schedule: cron(10 19 * * ? *)
```

Lambda ファンクションの実行感覚は template.yaml にて設定されている。
上記の場合は毎日午前 4 時 10 分に実行される。

## Deploy

```bash
$ sam package --template-file template_production.yaml --output-template-file packaged.yaml --s3-bucket yutoogi.sandbox

$ aws cloudformation deploy --template-file /Users/yuto-ogi/Work/aws_sam/auto_snapshot/packaged.yaml --stack-name AutoSnapshot  --capabilities CAPABILITY_IAM
```
 本番

```
$ sam package --template-file template_production.yaml --output-template-file packaged_production.yaml --s3-bucket.com --profile_auto_snapshot

$ aws cloudformation deploy --template-file packaged_production.yaml --stack-name AutoSnapshot  --capabilities CAPABILITY_IAM --profile_auto_snapshot --region ap-northeast-1
```

## local invoke

```bash
$ sam local invoke -e event.json AutoSnapshotFunction
$ sam local invoke -e event.json DeleteSnapshotFunction
```

## CloudWatch Events のルール式

[ルールのスケジュール式](https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/events/ScheduledEvents.html#RateExpressions)

日時はは UTC であることに注意。

## --capabilities オプションについて

[【小ネタ】AWS SAM を継続的デリバリする際に便利なオプションのご紹介](https://dev.classmethod.jp/cloud/aws/introducing-no-fail-on-empty-changeset-option-for-aws-serverless-application-model/)

[AWS Identity and Access Management によるアクセスの制御](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/using-iam-template.html)

## Lambda のタイムアウト設定について

[awslabs/serverless-application-model](https://github.com/awslabs/serverless-application-model/blob/master/versions/2016-10-31.md#api)

## Unitest

※ 環境変数かAWS CLIのconfigureで"ACCESS_KEY","SECRET_ACCESS_KEY"を設定しておく必要がある。

```
cd auto_snapshot
yarn install
yarn test
```

