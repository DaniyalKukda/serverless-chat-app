'use strict'
const aws = require("aws-sdk");
const dynamo = aws.Dynamodb();

module.exports.getConversations = (event, context, callback) => {
    const id = event.pathParameters.id
    dynamo.query({
        TableName: "Chat-Messages",
        ProjectionExpression: "#T,Sender,Messages",
        ExpressionAttributeName: { '#T': "Timestamp" },
        KeyConditonExpression: "ConversationId = :id",
        ExpressionAttributeValue: { ':id': { S: id } }
    }, (err, data) => {
        loadMessages(err, data, id, [], callback)
    })
}
function loadMessages(err, data, id, messages, callback) {
    if (err === null) {
        data.Items.forEach(message => {
            messages.push({
                sender: message.Sender,
                time: Number(message.Timestamp),
                message: message.Message
            })
        });
        if (data.LastEvaluatedKey) {
            dynamo.query({
                TableName: "Chat-Messages",
                ProjectionExpression: "#T,Sender,Messages",
                ExpressionAttributeName: { '#T': "Timestamp" },
                KeyConditonExpression: "ConversationId = :id",
                ExpressionAttributeValue: { ':id': { S: id } },
                ExclusiveStartKey: data.LastEvaluatedKey
            }, (err, data) => {
                loadMessages(err, data, id, [], callback)
            })
        } else {
            loadConversationDetails(id, messages, callback);
        }
    } else {
        callback(err)
    }
}
function loadConversationDetails(id, messages, callback) {
    dynamo.query({
        TableName: "Chat-Conversations",
        Select: "ALL_ATTRIBUTES",
        KeyConditonExpression: "ConversationId = :id",
        ExpressionAttributeValue: { ':id': { S: id } }
    }, (err, data) => {
        if (err === null) {
            let participants = [];
            data.Items.forEach(item => {
                participants.push(item.Username)
            });
            callback(null, {
                id,
                participants,
                last: messages.length > 0 ? messages[messages.length - 1].time : undefined,
                messages
            })
        } else {
            callback(err)
        }
    })
}