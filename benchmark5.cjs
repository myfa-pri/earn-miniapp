const maxUsers = 10000;
let queueArray = [];
let queueDict = {};
let queueUserIndex = new Set();

// Setup queue array (what the code currently does)
for (let i = 0; i < maxUsers; i++) {
    queueArray.push({
        id: 'sub_' + i,
        userId: 'user_' + i,
        imgUrl: 'base64',
        submittedAt: Date.now()
    });
}

// Setup queue dict where key is submissionId (id) + Set for users
for (let i = 0; i < maxUsers; i++) {
    queueDict['sub_' + i] = {
        id: 'sub_' + i,
        userId: 'user_' + i,
        imgUrl: 'base64',
        submittedAt: Date.now()
    };
    queueUserIndex.add('user_' + i);
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

// 2. Object Lookup (Sub)
console.time('Object lookup (Sub)');
for (let i = 0; i < ITERATIONS; i++) {
    const val = queueDict[targetSub];
}
console.timeEnd('Object lookup (Sub)');


// 2b. Set lookup for userId
console.time('Set has userId (User)');
for (let i = 0; i < ITERATIONS; i++) {
    queueUserIndex.has(targetUser);
}
console.timeEnd('Set has userId (User)');
