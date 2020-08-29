module.exports.getAllConversations = (event, context, callback) => {
    dynamo.query({
        TableName: "Chat-Conversations",
        IndexName: "Username-conversationId-index",
        Select: "ALL_PROJECTED_ATTRIBUTES",
        KeyConditonExpression: "Username = :Username",
        ExpressionAttributeValue: { ':Username': { S: 'Student' } } // user name student is dummy username will be put dynamically via API
    }, (err, data) => {
        handleIdQuery(err, data, callback, [], "Student") // student is dummy username, it will put dynamically via api
    })

};

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