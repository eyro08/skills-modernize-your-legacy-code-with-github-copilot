'use strict';

const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const STARTING_BALANCE_CENTS = 100_000;
const MAX_BALANCE_CENTS = 99_999_999;
const AMOUNT_PATTERN = /^(\d{1,6})(?:\.(\d{1,2}))?$/;

function parseAmountToCents(rawAmount) {
    const amountMatch = AMOUNT_PATTERN.exec(rawAmount.trim());
    if (!amountMatch) {
        return null;
    }

    const wholeUnits = Number.parseInt(amountMatch[1], 10);
    const fractionalUnits = Number((amountMatch[2] ?? '').padEnd(2, '0'));
    return wholeUnits * 100 + fractionalUnits;
}

function formatBalance(balanceCents) {
    const wholeUnits = Math.floor(balanceCents / 100);
    const fractionalUnits = balanceCents % 100;
    return `${String(wholeUnits).padStart(6, '0')}.${String(fractionalUnits).padStart(2, '0')}`;
}

function validateAmount(amountCents) {
    if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > MAX_BALANCE_CENTS) {
        throw new RangeError('Amount is outside the supported account range.');
    }
}

class Account {
    #balanceCents;

    constructor(initialBalanceCents = STARTING_BALANCE_CENTS) {
        if (!Number.isSafeInteger(initialBalanceCents) || initialBalanceCents < 0 || initialBalanceCents > MAX_BALANCE_CENTS) {
            throw new RangeError('Initial balance is outside the supported account range.');
        }
        this.#balanceCents = initialBalanceCents;
    }

    getBalanceCents() {
        return this.#balanceCents;
    }

    credit(amountCents) {
        validateAmount(amountCents);
        if (this.#balanceCents + amountCents > MAX_BALANCE_CENTS) {
            return false;
        }
        this.#balanceCents += amountCents;
        return true;
    }

    debit(amountCents) {
        validateAmount(amountCents);
        if (amountCents > this.#balanceCents) {
            return false;
        }
        this.#balanceCents -= amountCents;
        return true;
    }
}

function displayMenu(output) {
    output.write('--------------------------------\n');
    output.write('Account Management System\n');
    output.write('1. View Balance\n');
    output.write('2. Credit Account\n');
    output.write('3. Debit Account\n');
    output.write('4. Exit\n');
    output.write('--------------------------------\n');
}

async function askLine(inputLines, output, prompt) {
    output.write(prompt);
    const lineResult = await inputLines.next();
    return lineResult.done ? null : lineResult.value;
}

async function runApp({ input = stdin, output = stdout } = {}) {
    const readlineInterface = readline.createInterface({ input, output });
    const inputLines = readlineInterface[Symbol.asyncIterator]();
    const account = new Account();
    let shouldContinue = true;

    try {
        while (shouldContinue) {
            displayMenu(output);
            const rawChoice = await askLine(inputLines, output, 'Enter your choice (1-4): ');
            if (rawChoice === null) {
                shouldContinue = false;
                break;
            }
            const choice = rawChoice.trim();

            switch (choice) {
                case '1':
                    output.write(`Current balance: ${formatBalance(account.getBalanceCents())}\n`);
                    break;
                case '2':
                case '3': {
                    const isCredit = choice === '2';
                    const prompt = isCredit ? 'Enter credit amount: ' : 'Enter debit amount: ';
                    const rawAmount = await askLine(inputLines, output, prompt);
                    if (rawAmount === null) {
                        shouldContinue = false;
                        break;
                    }
                    const amountCents = parseAmountToCents(rawAmount);

                    if (amountCents === null) {
                        output.write('Invalid amount. Enter a non-negative amount with up to 6 integer digits and 2 decimal places.\n');
                    } else if (isCredit && !account.credit(amountCents)) {
                        output.write('Credit would exceed the maximum balance.\n');
                    } else if (!isCredit && !account.debit(amountCents)) {
                        output.write('Insufficient funds for this debit.\n');
                    } else if (isCredit) {
                        output.write(`Amount credited. New balance: ${formatBalance(account.getBalanceCents())}\n`);
                    } else {
                        output.write(`Amount debited. New balance: ${formatBalance(account.getBalanceCents())}\n`);
                    }
                    break;
                }
                case '4':
                    shouldContinue = false;
                    break;
                default:
                    output.write('Invalid choice, please select 1-4.\n');
            }
        }

        output.write('Exiting the program. Goodbye!\n');
    } finally {
        readlineInterface.close();
    }
}

if (require.main === module) {
    runApp().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = { Account, formatBalance, parseAmountToCents, runApp };