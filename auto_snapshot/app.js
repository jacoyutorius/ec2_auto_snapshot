const AWS = require("aws-sdk")
AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION
})
const ec2 = new AWS.EC2()

//自動スナップショット対象かどうかを判断するTag
const snapshotTagKey = "SnapshotGeneration"

async function createInstanceSnapshot() {
  var instances = await getSnapshotTargetInstances()

  var createResult = instances.map(async (instance) => {
    var instanceParams = {
      Filters: [{
        Name: "resource-id",
        Values: [
          instance.InstanceId
        ]
      }]
    }

    var snapshotGenerationTag = instance.Tags.find((tag) => {
      return tag.Key === snapshotTagKey
    })
    if (snapshotGenerationTag && snapshotGenerationTag.Value > 0) {
      var volumeId = getInstanceEbsVolumeId(instance)
      var instanceName = getInstanceName(instance)
      var ret = await createSnapshot(instanceName, volumeId, instance.InstanceId)
      console.log(ret)
      return ret
    }
  })

  return createResult
}

// EBSのスナップショットを作成する
async function createSnapshot(instanceName, volumeId, instanceId) {
  var tags = [{
    Key: "Name",
    Value: "AutoSnapshot",
  }, {
    Key: "InstanceId",
    Value: instanceId
  }, {
    Key: "AutoSnapshot",
    Value: String(new Date())
  }]
  if (instanceName) {
    tags.push({
      Key: "InstanceName",
      Value: instanceName
    })
  }

  var params = {
    VolumeId: volumeId,
    Description: "[Auto Snapshot] " + "InstanceName:" + instanceName + ", InstanceId:" + instanceId,
    TagSpecifications: [{
      ResourceType: "snapshot",
      Tags: tags
    }]
  };


  var ret = await ec2.createSnapshot(params).promise().catch((err) => {
    console.log(err, err.stack)
  })
  return ret
}

// インスタンスのEBSボリュームIDを取得する
function getInstanceEbsVolumeId(instance) {
  var blockDevises = instance.BlockDeviceMappings
  var ebsDevise = blockDevises.find((row) => {
    return Object.keys(row).includes("Ebs")
  })
  return ebsDevise.Ebs.VolumeId
}

// インスタンスのTagにNameが登録されていればその値を返す。設定されていなければblankを返す
function getInstanceName(instance) {
  var nameTag = instance.Tags.find((tag) => {
    return tag.Key === "Name"
  })
  return nameTag ? nameTag.Value : ""
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

exports.lambda_handler = async (event, context, callback) => {
  try {
    const ret = await createInstanceSnapshot();
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
// createInstanceSnapshot()