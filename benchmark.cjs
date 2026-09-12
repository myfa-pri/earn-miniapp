const crypto = require('crypto');

// Simulate db data
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

// Setup queue dict
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

// 1. Array find
console.time('Array.find (User)');
let foundCount = 0;
for (let i = 0; i < ITERATIONS; i++) {
    if (queueArray.find(q => q.userId === targetUser)) {
        foundCount++;
    }
}
console.timeEnd('Array.find (User)');

// 2. Array findIndex & splice (Review)
console.time('Array.findIndex + splice (Sub)');
let copyQueueArray = [...queueArray];
for (let i = 0; i < 100; i++) { // Can't run 10000 splices since array gets empty, just testing time of finding
    const idx = copyQueueArray.findIndex(q => q.id === targetSub);
    if(idx !== -1) {
        // Just simulating the cost of findIndex, don't splice everything to keep index high
    }
}
console.timeEnd('Array.findIndex + splice (Sub)');


// 3. Object Lookup
console.time('Object lookup (User)');
let foundDictCount = 0;
for (let i = 0; i < ITERATIONS; i++) {
    if (queueDict[targetUser]) {
        foundDictCount++;
    }
}
console.timeEnd('Object lookup (User)');


// 4. Object keys + map iteration check
console.time('Object keys map overhead');
let v = 0;
for (let i = 0; i < 100; i++) {
    const vals = Object.values(queueDict);
    v += vals.length;
}
console.timeEnd('Object keys map overhead');
