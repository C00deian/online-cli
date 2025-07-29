const AWS = require("aws-sdk");
AWS.config.update({
  accessKeyId: "AKIAWL5KCHFWJQQMTX4P",
  region: "ap-south-1",
  secretAccessKey: "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",
});

const ec2 = new AWS.EC2();
const ssm = new AWS.SSM();

exports.createInstance = async ({ ami_id, instance_type, volume_size }) => {
  try {
    // 🔍 Step 1: Get AMI root device name
    const image = await ec2.describeImages({ ImageIds: [ami_id] }).promise();
    const rootDeviceName = image.Images[0].RootDeviceName;

    // 🚀 Step 2: Launch instance with custom volume size
    const res = await ec2
      .runInstances({
        ImageId: ami_id,
        InstanceType: instance_type,
        MinCount: 1,
        MaxCount: 1,
        IamInstanceProfile: {
          Name: "EC2SSMProfile",
        },
        BlockDeviceMappings: [
          {
            DeviceName: rootDeviceName,
            Ebs: {
              VolumeSize: volume_size,
              VolumeType: "gp3",
              DeleteOnTermination: true,
            },
          },
        ],
        TagSpecifications: [
          {
            ResourceType: "instance",
            Tags: [{ Key: "Name", Value: `VM-${Date.now()}` }],
          },
        ],
      })
      .promise();

    const instance = res.Instances[0];
    return {
      instanceId: instance.InstanceId,
      volumeSize: volume_size,
    };
  } catch (err) {
    console.error("Failed to create instance:", err);
    throw err;
  }
};

exports.startSSMSession = async (instanceId) => {
  const result = await ssm
    .startSession({
      Target: instanceId,
    })
    .promise();

  return result;
};

exports.terminateInstance = async (instanceId) => {
  try {
    const res = await ec2
      .terminateInstances({
        InstanceIds: [instanceId],
      })
      .promise();

    return res.TerminatingInstances[0]; // Contains InstanceId, PreviousState, CurrentState
  } catch (err) {
    console.error("❌ Failed to terminate instance:", err);
    throw err;
  }
};

exports.stopInstance = async (id) =>
  await ec2.stopInstances({ InstanceIds: [id] }).promise();

exports.hibernateInstance = async (id) =>
  await ec2
    .stopInstances({
      InstanceIds: [id],
      Hibernate: true,
    })
    .promise();
exports.sendCommandToInstance = async (instanceId, command) => {
  const sendResult = await ssm
    .sendCommand({
      DocumentName: "AWS-RunShellScript",
      InstanceIds: [instanceId],
      Parameters: { commands: [command] },
    })
    .promise();

  const commandId = sendResult.Command.CommandId;

  let output = "";
  let errorOutput = "";
  let tries = 0;

  while (tries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    tries++;

    const result = await ssm
      .getCommandInvocation({
        InstanceId: instanceId,
        CommandId: commandId,
      })
      .promise();

    if (result.Status === "Success") {
      output = result.StandardOutputContent || "";
      break;
    } else if (["Failed", "Cancelled", "TimedOut"].includes(result.Status)) {
      errorOutput = result.StandardErrorContent || "Command failed";
      break;
    }
  }

  if (output) {
    return { output };
  } else {
    return { error: errorOutput || "Command failed" };
  }
};
