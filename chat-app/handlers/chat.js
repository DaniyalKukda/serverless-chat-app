const aws = require("aws-sdk");
const dynamo = aws.Dynamodb();

module.exports.chat = (event, context, callback) => {
    const id = event.pathParameters.id
    const body = JSON.stringify(event.body)
    const username = body.username;
    const message = body.message;
    dynamo.putItem({
        TableName: "Chat-Messages",
        Item: {
            ConversationId: { S: id },
            Timestamp: { N: "" + new Date().getTime() },
            Message: { S: message },
            Sender: { S: username }
        }
    },
        callback
    );
}
