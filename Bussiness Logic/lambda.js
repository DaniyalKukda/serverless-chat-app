"use strict"

const aws = require("aws-sdk")
const dynamo = aws.Dynamodb();

module.exports = (event, context, callback) => {
    const done = function (err, res) {
        callback(null, {
            statusCode: err ? "400" : "200",
            body: err ? JSON.stringify(err) : JSON.stringify(res),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        })
    };
    const path = even.pathParameters.proxy;
    if (path === "conversations" && event.httpMethod === "GET") {
        dynamo.query({
            TableName: "Chat-Conversations",
            IndexName: "Username-conversationId-index",
            Select: "ALL_PROJECTED_ATTRIBUTES",
            KeyConditonExpression: "Username = :Username",
            ExpressionAttributeValue: { ':Username': { S: 'Student' } } // user name student is dummy username will be put dynamically via API
        }, (err, data) => {
            handleIdQuery(err, data, done, [], "Student") // student is dummy username, it will put dynamically via api
        })
    } else if (path.startWith('conversations/')) {
        const id = path.subString('conversations/'.length);
        switch (event.httpMethod) {
            case "GET":
                dynamo.query({
                    TableName: "Chat-Messages",
                    ProjectionExpression: "#T,Sender,Messages",
                    ExpressionAttributeName: { '#T': "Timestamp" },
                    KeyConditonExpression: "ConversationId = :id",
                    ExpressionAttributeValue: { ':id': { S: id } }
                }, (err, data) => {
                    loadMessages(err, data, id, [], done)
                })
                break;
            case "POST":
                dynamo.put({
                    TableName: "Chat-Messages",
                    Item: {
                        ConversationId: { S: id },
                        Timestamp: { N: "" + new Date().getTime() },
                        Message: { S: event.body.message },
                        Sender: { S: event.body.username }
                    }
                },
                    done()
                );
                break;
            default:
                done("no case hit");
                break;
        }
    } else {
        done("no case hit");
    }
};
function loadMessages(err, data, id, messages, callback) {
    if (err === null) {
        data.Items.forEach(message => {
            messages.push({
                sender: message.sender,
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
function handleIdQuery(err, data, callback, ids, username) {
    if (err === null) {
        data.Items.forEach(item => {
            ids.push(item.ConversationId)
        });
        if (data.LastEvaluatedKey) {
            dynamo.query({
                TableName: "Chat-Conversations",
                IndexName: "Username-conversationId-index",
                Select: "ALL_PROJECTED_ATTRIBUTES",
                KeyConditonExpression: "Username = :Username",
                ExpressionAttributeValue: { ':Username': { S: username } },
                ExclusiveStartKey: data.LastEvaluatedKey
            }, (err, data) => {
                handleIdQuery(err, data, callback, ids, username)
            })
        } else {
            loadDetails(ids, callback);
        }
    } else {
        callback(err);
    }
}
function loadDetails(ids, callback) {
    let convos = [];
    ids.forEach(id => {
        convos.push({ id })
    });
    if (convos.length > 0) {
        convos.forEach(convo => {
            loadConvoLast(convo, convos, callback);
        })
    } else {
        callback(null, convos);
    }
}
function loadConvoLast(convo, convos, callback) {
    dynamo.query({
        TableName: "Chat-Messages",
        ProjectionExpression: "#T",
        Limit: 1,
        ScanIndexForward: false,
        KeyConditonExpression: "ConversationId = :id",
        ExpressionAttributeName: { '#T': "Timestamp" },
        ExpressionAttributeValue: { ':id': { S: convo.id } },
    }, (err, data) => {
        if (err === null) {
            if (data.Items.length === 1) {
                convo.last = Number(data.Items[0].Timestamp);
            }
            loadConvoParticipants(convo, convos, callback);
        } else {
            callback(err)
        }
    })
}
function loadConvoParticipants(convo, convos, callback) {
    dynamo.query({
        TableName: "Chat-Conversations",
        Select: "ALL_ATTRIBUTES",
        KeyConditonExpression: "ConversationId = :id",
        ExpressionAttributeValue: { ':id': { S: convo.id } }
    }, (err, data) => {
        if (err === null) {
            let participants = [];
            data.Items.forEach(item => {
                participants.push(item.Username)
            });
            convo.participants = participants;
            if (finished(convos)) {
                callback(null, convos)
            }
        } else {
            callback(err)
        }
    })
}
function finished(convos) {
    for (let i = 0; i < convos.length; i++) {
        if (!convos[i].participants) {
            return false
        }
    }
    return true;
}