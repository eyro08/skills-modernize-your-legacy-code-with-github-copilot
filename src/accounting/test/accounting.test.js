'use strict';

const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const { Account, formatBalance, parseAmountToCents, runApp } = require('../index');

async function runAppWithInput(inputText) {
    const input = new PassThrough();
    const output = new PassThrough();
    let capturedOutput = '';

    output.setEncoding('utf8');
    output.on('data', (chunk) => {
        capturedOutput += chunk;
    });

    const appRun = runApp({ input, output });
    input.end(inputText);
    await appRun;

    return capturedOutput;
}

function countOccurrences(text, pattern) {
    return (text.match(pattern) ?? []).length;
}

test('TC-001 displays the initial balance and returns to the menu', async () => {
    const output = await runAppWithInput('1\n4\n');

    assert.match(output, /Current balance: 001000\.00/);
    assert.equal(countOccurrences(output, /Account Management System/g), 2);
});

test('TC-002 credit increases and displays the balance', async () => {
    const output = await runAppWithInput('2\n250\n1\n4\n');

    assert.match(output, /Amount credited\. New balance: 001250\.00/);
    assert.match(output, /Current balance: 001250\.00/);
});

test('TC-003 zero-value credit succeeds without changing the balance', async () => {
    const account = new Account();
    const output = await runAppWithInput('2\n0\n1\n4\n');

    assert.equal(account.credit(0), true);
    assert.equal(formatBalance(account.getBalanceCents()), '001000.00');
    assert.match(output, /Amount credited\. New balance: 001000\.00/);
    assert.match(output, /Current balance: 001000\.00/);
});

test('TC-004 debit below the balance succeeds and updates the balance', async () => {
    const account = new Account();
    const debitSucceeded = account.debit(parseAmountToCents('250'));
    const output = await runAppWithInput('3\n250\n1\n4\n');

    assert.equal(debitSucceeded, true);
    assert.equal(formatBalance(account.getBalanceCents()), '000750.00');
    assert.match(output, /Amount debited\. New balance: 000750\.00/);
    assert.match(output, /Current balance: 000750\.00/);
});

test('TC-005 debit equal to the balance is allowed', async () => {
    const account = new Account();
    const debitSucceeded = account.debit(account.getBalanceCents());
    const output = await runAppWithInput('3\n1000\n1\n4\n');

    assert.equal(debitSucceeded, true);
    assert.equal(formatBalance(account.getBalanceCents()), '000000.00');
    assert.match(output, /Amount debited\. New balance: 000000\.00/);
    assert.match(output, /Current balance: 000000\.00/);
});

test('TC-006 debit above the balance is rejected without changing it', async () => {
    const account = new Account();
    const debitSucceeded = account.debit(parseAmountToCents('1001'));
    const output = await runAppWithInput('3\n1001\n1\n4\n');

    assert.equal(debitSucceeded, false);
    assert.equal(formatBalance(account.getBalanceCents()), '001000.00');
    assert.match(output, /Insufficient funds for this debit\./);
    assert.match(output, /Current balance: 001000\.00/);
});

test('TC-007 zero-value debit succeeds without changing the balance', async () => {
    const account = new Account();
    const debitSucceeded = account.debit(0);
    const output = await runAppWithInput('3\n0\n1\n4\n');

    assert.equal(debitSucceeded, true);
    assert.equal(formatBalance(account.getBalanceCents()), '001000.00');
    assert.match(output, /Amount debited\. New balance: 001000\.00/);
    assert.match(output, /Current balance: 001000\.00/);
});

test('TC-008 successive operations use the latest balance', async () => {
    const account = new Account();
    account.credit(parseAmountToCents('300'));
    account.debit(parseAmountToCents('125'));
    const output = await runAppWithInput('2\n300\n3\n125\n1\n4\n');

    assert.equal(formatBalance(account.getBalanceCents()), '001175.00');
    assert.match(output, /Current balance: 001175\.00/);
});

test('TC-009 invalid numeric menu choice reports an error and preserves balance', async () => {
    const output = await runAppWithInput('5\n1\n4\n');

    assert.match(output, /Invalid choice, please select 1-4\./);
    assert.match(output, /Current balance: 001000\.00/);
    assert.equal(countOccurrences(output, /Account Management System/g), 3);
});

test('TC-010 exit displays goodbye and stops the menu loop', async () => {
    const output = await runAppWithInput('4\n');

    assert.match(output, /Exiting the program\. Goodbye!/);
    assert.equal(countOccurrences(output, /Account Management System/g), 1);
});

test('TC-011 a new app run starts with a fresh in-memory balance', async () => {
    const firstRun = await runAppWithInput('2\n100\n4\n');
    const secondRun = await runAppWithInput('1\n4\n');

    assert.match(firstRun, /Amount credited\. New balance: 001100\.00/);
    assert.match(secondRun, /Current balance: 001000\.00/);
});

test('TC-012 the menu has no student or account-selection flow', async () => {
    const output = await runAppWithInput('1\n4\n');

    assert.match(output, /1\. View Balance/);
    assert.match(output, /2\. Credit Account/);
    assert.match(output, /3\. Debit Account/);
    assert.doesNotMatch(output, /student|select an account/i);
});

test('TC-013 invalid, negative, and over-precision amounts are rejected unchanged', async () => {
    const invalidAmounts = ['not-a-number', '-1', '1000000', '1.234'];

    assert.equal(parseAmountToCents('999999.99'), 99_999_999);
    for (const amount of invalidAmounts) {
        const output = await runAppWithInput(`2\n${amount}\n1\n4\n`);

        assert.match(output, /Invalid amount\./);
        assert.match(output, /Current balance: 001000\.00/);
        assert.doesNotMatch(output, /Amount credited\./);
    }
});

test('TC-014 credit that exceeds balance capacity is rejected unchanged', async () => {
    const account = new Account();
    const creditSucceeded = account.credit(parseAmountToCents('999000'));
    const output = await runAppWithInput('2\n999000\n1\n4\n');

    assert.equal(creditSucceeded, false);
    assert.equal(formatBalance(account.getBalanceCents()), '001000.00');
    assert.match(output, /Credit would exceed the maximum balance\./);
    assert.match(output, /Current balance: 001000\.00/);
});