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
    queueDict['sub_' + i] = {
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

// 2. Object values + find (User)
console.time('Object.values + find (User)');
for (let i = 0; i < ITERATIONS; i++) {
    Object.values(queueDict).find(q => q.userId === targetUser);
}
console.timeEnd('Object.values + find (User)');

// 2b. Object Lookup (Sub)
console.time('Object lookup (Sub)');
for (let i = 0; i < ITERATIONS; i++) {
    const val = queueDict[targetSub];
}
console.timeEnd('Object lookup (Sub)');

// If we change it to an object where key is userId
let queueDictByUser = {};
for (let i = 0; i < maxUsers; i++) {
    queueDictByUser['user_' + i] = {
        id: 'sub_' + i,
        userId: 'user_' + i,
        imgUrl: 'base64',
        submittedAt: Date.now()
    };
}

// 3. Object Lookup (User)
console.time('Object lookup (User)');
for (let i = 0; i < ITERATIONS; i++) {
    const val = queueDictByUser[targetUser];
}
console.timeEnd('Object lookup (User)');

// 3b. Object values + find (Sub)
console.time('Object.values + find (Sub)');
for (let i = 0; i < ITERATIONS; i++) {
    Object.values(queueDictByUser).find(q => q.id === targetSub);
}
console.timeEnd('Object.values + find (Sub)');
