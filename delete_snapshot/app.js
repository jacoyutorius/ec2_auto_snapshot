const AWS = require("aws-sdk")
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION
})
const ec2 = new AWS.EC2()

//自動スナップショット対象かどうかを判断するTag
const snapshotTagKey = "SnapshotGeneration"

//自動Snapshotを残す最大数
const snapshotMaxCount = 7

// インスタンスのEBSボリュームIDを取得する
function getInstanceEbsVolumeId(instance) {
  var blockDevises = instance.BlockDeviceMappings
  var ebsDevise = blockDevises.find((row) => {
    return Object.keys(row).includes("Ebs")
  })
  return ebsDevise.Ebs.VolumeId
}

// バックアップ対象のEC2インスタンスの一覧を取得する
async function getSnapshotTargetInstances() {
  var params = {
    Filters: [{
      Name: "tag-key",
      Values: [snapshotTagKey]
    }]
  }
  var ret = await ec2.describeInstances(params).promise().catch((err) => {
    console.log(err, err.stack)
  })

  return ret.Reservations.reduce((array, reservations) => {
    return array.concat(reservations.Instances)
  }, [])
}

async function deleteOldSnapshots() {
  var instances = await getSnapshotTargetInstances()
  var deleteResult = instances.map(async (instance) => {
    var volumeId = getInstanceEbsVolumeId(instance)
    var data = await getDeleteTargetSnaphots(volumeId)

    // 古いスナップショット順にsort
    data.Snapshots.sort((a, b) => {
      if (a.StartTime < b.StartTime) return -1
      if (a.StartTime > b.StartTime) return 1
      return 0
    })

    if (data.Snapshots.length <= snapshotMaxCount) return

    var result = []
    for (var i = 0; i < (data.Snapshots.length - snapshotMaxCount); i++) {
      var snapshot = data.Snapshots[i]
      console.log("delete " + snapshot.SnapshotId)
      var ret = await deleteSnaphot(snapshot.SnapshotId)

      result.push({
        message: "delete " + snapshot.SnapshotId,
        log: ret
      })
    }

    return result
  })

  return deleteResult;
}

// snapshotIdに合致するスナップショットを削除する
async function deleteSnaphot(snapshotId) {
  var params = {
    SnapshotId: snapshotId
  };
  return await ec2.deleteSnapshot(params).promise().catch((err) => {
    console.log(err, err.stack)
  })
}

// volumeIdに紐づくEBSスナップショットの一覧を取得する
async function getDeleteTargetSnaphots(volumeId) {
  var params = {
    Filters: [{
      Name: "volume-id",
      Values: [
        volumeId
      ]
    }, {
      Name: "tag-key",
      Values: [
        "AutoSnapshot"
      ]
    }]
  };
  return await ec2.describeSnapshots(params).promise().catch((err) => {
    console.log(err, err.stack)
  });
}

exports.lambda_handler = async (event, context, callback) => {
  try {
    const ret = await deleteOldSnapshots();
    response = {
      'statusCode': 200,
      'body': JSON.stringify(ret)
    }
  } catch (err) {
    console.log(err);
    callback(err, null);
  }

  callback(null, response)
};

// execute local
// deleteOldSnapshots()