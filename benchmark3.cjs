const maxUsers = 10000;
let queueArray = [];
let queueDict = {};

// Setup queue array (what the code currently does)
for (let i = 0; i < maxUsers; i++) {
    queueArray.push({
        id: 'sub_' + i,
        userId: 'user_' + i,
        imgUrl: 'base64',
        submittedAt: Date.now()
    });
}

// Setup queue dict where key is userId
for (let i = 0; i < maxUsers; i++) {
    queueDict['user_' + i] = {
        id: 'sub_' + i,
        userId: 'user_' + i,
        imgUrl: 'base64',
        submittedAt: Date.now()
    };
}

const targetUser = 'user_' + (maxUsers - 1);
const targetSub = 'sub_' + (maxUsers - 1);

const ITERATIONS = 10000;

console.log(`Benchmarking with queue size: ${maxUsers}, Iterations: ${ITERATIONS}`);

// 1. Array find (User)
console.time('Array.find (User)');
for (let i = 0; i < ITERATIONS; i++) {
    queueArray.find(q => q.userId === targetUser);
}
console.timeEnd('Array.find (User)');

// 1b. Array findIndex (Sub)
console.time('Array.findIndex (Sub)');
for (let i = 0; i < ITERATIONS; i++) {
    queueArray.findIndex(q => q.id === targetSub);
}
console.timeEnd('Array.findIndex (Sub)');

// 2. Object Lookup (User)
console.time('Object lookup (User)');
for (let i = 0; i < ITERATIONS; i++) {
    const val = queueDict[targetUser];
}
console.timeEnd('Object lookup (User)');


// 2b. Object keys iteration for delete/approve
console.time('Object find key by id (Sub)');
for (let i = 0; i < ITERATIONS; i++) {
    let targetKey;
    for (const key in queueDict) {
        if (queueDict[key].id === targetSub) {
            targetKey = key;
            break;
        }
    }
}
console.timeEnd('Object find key by id (Sub)');
