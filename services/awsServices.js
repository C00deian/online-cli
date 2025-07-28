const AWS = require("aws-sdk");
AWS.config.update({

});

const ec2 = new AWS.EC2();
const ssm = new AWS.SSM();

exports.createInstance = async ({ ami_id, instance_type }) => {
  const res = await ec2
    .runInstances({
      ImageId: ami_id,    // e.g. Ubuntu AMI for ap-south-1
      InstanceType: instance_type,
      MinCount: 1,
      MaxCount: 1,
      IamInstanceProfile: {
        Name: "EC2SSMInstanceProfile", //✅ Must exist and contain AmazonSSMManagedInstanceCore
      },
      NetworkInterfaces: [
        {
          DeviceIndex: 0,
          AssociatePublicIpAddress: true, //✅ PUBLIC IP
          SubnetId: "subnet-098fd7ca9bb68175c",
          Groups: ["sg-05ea4a7751771fff7"],
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

  return {
    instanceId: res.Instances[0].InstanceId,
    publicIp: res.Instances[0].PublicIpAddress ?? "Fetching...",
  };
};

exports.startSSMSession = async (instanceId) => {
  const result = await ssm
    .startSession({
      Target: instanceId,
    })
    .promise();

  return result;
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
  const sendResult = await ssm.sendCommand({
    DocumentName: "AWS-RunShellScript",
    InstanceIds: [instanceId],
    Parameters: { commands: [command] },
  }).promise();

  const commandId = sendResult.Command.CommandId;

  let output = '';
  let errorOutput = '';
  let tries = 0;

  while (tries < 10) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    tries++;

    const result = await ssm.getCommandInvocation({
      InstanceId: instanceId,
      CommandId: commandId,
    }).promise();

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
