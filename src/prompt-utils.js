import readline from 'readline';

/**
 * Create a readline interface for interactive prompts
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask a simple question and return the answer
 */
export async function askQuestion(question) {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Present a numbered list of options and let user select one
 */
export async function selectFromList(title, options, labelKey = 'name') {
  if (!options || options.length === 0) {
    throw new Error('No options available for selection');
  }

  console.log(`\n📋 ${title}`);
  console.log('═'.repeat(50));
  
  options.forEach((option, index) => {
    const label = typeof option === 'string' ? option : option[labelKey];
    console.log(`${index + 1}. ${label}`);
  });
  
  console.log('═'.repeat(50));
  
  while (true) {
    const answer = await askQuestion(`Select option (1-${options.length}): `);
    const selection = parseInt(answer, 10);
    
    if (selection >= 1 && selection <= options.length) {
      const selectedOption = options[selection - 1];
      const selectedLabel = typeof selectedOption === 'string' ? selectedOption : selectedOption[labelKey];
      console.log(`✅ Selected: ${selectedLabel}\n`);
      return selectedOption;
    } else {
      console.log(`❌ Invalid selection. Please enter a number between 1 and ${options.length}.`);
    }
  }
}

/**
 * Present list selection with option to create new list
 */
export async function selectListWithCreateOption(title, lists, labelKey = 'name') {
  console.log(`\n📋 ${title}`);
  console.log('═'.repeat(50));
  
  // Show existing lists or message if empty
  if (lists.length === 0) {
    console.log('⚠️  No lists found in board');
  } else {
    lists.forEach((list, index) => {
      const label = typeof list === 'string' ? list : list[labelKey];
      console.log(`${index + 1}. ${label}`);
    });
  }
  
  // Add create new option
  console.log(`${lists.length + 1}. ➕ Create new list`);
  console.log('═'.repeat(50));
  
  while (true) {
    const answer = await askQuestion(`Select option (1-${lists.length + 1}): `);
    const selection = parseInt(answer, 10);
    
    if (selection >= 1 && selection <= lists.length) {
      // Selected existing list
      const selectedList = lists[selection - 1];
      const selectedLabel = typeof selectedList === 'string' ? selectedList : selectedList[labelKey];
      console.log(`✅ Selected: ${selectedLabel}\n`);
      return { type: 'existing', list: selectedList };
    } else if (selection === lists.length + 1) {
      // Selected create new list
      console.log('✅ Selected: Create new list\n');
      return { type: 'create_new' };
    } else {
      console.log(`❌ Invalid selection. Please enter a number between 1 and ${lists.length + 1}.`);
    }
  }
}

/**
 * Present label selection with option to create new label or skip
 */
export async function selectLabelWithCreateOption(title, labels, labelKey = 'name') {
  console.log(`\n📋 ${title}`);
  console.log('═'.repeat(50));
  
  // First option: Skip (no label)
  console.log(`1. ⏭️  Skip (no label)`);

  // Show existing labels after skip
  labels.forEach((label, index) => {
    const labelName = typeof label === 'string' ? label : label[labelKey];
    const color = label.color ? ` (${label.color})` : '';
    console.log(`${index + 2}. ${labelName}${color}`);
  });
  
  // Add create new as the last option
  console.log(`${labels.length + 2}. ➕ Create new label`);
  console.log('═'.repeat(50));
  
  const maxOption = labels.length + 2;
  while (true) {
    const answer = await askQuestion(`Select option (1-${maxOption}): `);
    const selection = parseInt(answer, 10);
    
    if (selection === 1) {
      // Selected skip
      console.log('✅ Selected: Skip (no label)\n');
      return { type: 'skip' };
    } else if (selection >= 2 && selection <= labels.length + 1) {
      // Selected existing label (offset by 2 -> labels[selection-2])
      const selectedLabel = labels[selection - 2];
      const selectedLabelName = typeof selectedLabel === 'string' ? selectedLabel : selectedLabel[labelKey];
      console.log(`✅ Selected: ${selectedLabelName}\n`);
      return { type: 'existing', label: selectedLabel };
    } else if (selection === maxOption) {
      // Selected create new label
      console.log('✅ Selected: Create new label\n');
      return { type: 'create_new' };
    } else {
      console.log(`❌ Invalid selection. Please enter a number between 1 and ${maxOption}.`);
    }
  }
}

/**
 * Ask user to select a label color
 */
export async function selectLabelColor() {
  const colors = [
    { name: 'Blue', value: 'lagoon-blue' },
    { name: 'Green', value: 'fresh-salad' },
    { name: 'Orange', value: 'pumpkin-orange' },
    { name: 'Red', value: 'autumn-leafs' },
    { name: 'Yellow', value: 'egg-yellow' },
    { name: 'Purple', value: 'midnight-blue' },
    { name: 'Grey', value: 'muddy-grey' },
    { name: 'Light Blue', value: 'morning-sky' }
  ];
  
  console.log('\n🎨 Select Label Color');
  console.log('═'.repeat(50));
  
  colors.forEach((color, index) => {
    console.log(`${index + 1}. ${color.name}`);
  });
  
  console.log('═'.repeat(50));
  
  while (true) {
    const answer = await askQuestion(`Select color (1-${colors.length}): `);
    const selection = parseInt(answer, 10);
    
    if (selection >= 1 && selection <= colors.length) {
      const selectedColor = colors[selection - 1];
      console.log(`✅ Selected color: ${selectedColor.name}\n`);
      return selectedColor.value;
    } else {
      console.log(`❌ Invalid selection. Please enter a number between 1 and ${colors.length}.`);
    }
  }
}

/**
 * Ask for text input with a prompt
 */
export async function askForInput(prompt, defaultValue = null) {
  const question = defaultValue 
    ? `${prompt} (default: ${defaultValue}): `
    : `${prompt}: `;
    
  const answer = await askQuestion(question);
  return answer || defaultValue;
}

/**
 * Ask for optional subtasks (comma-separated)
 */
export async function askForSubtasks() {
  console.log('\n📝 Optional: Add subtasks (comma-separated)');
  const subtasksInput = await askQuestion('Subtasks (press Enter to skip): ');
  
  if (!subtasksInput) {
    return [];
  }
  
  return subtasksInput
    .split(',')
    .map(task => task.trim())
    .filter(task => task.length > 0);
}

/**
 * Ask for a due date with smart parsing
 */
export async function askForDueDate() {
  // Detect user locale for examples and numeric date parsing
  const locale = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().locale : (process.env.LANG || 'en-US');
  const sample = new Date(2025, 9, 12); // 12 Oct 2025
  const sampleFormatted = sample.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  console.log('\n📅 Optional: Set due date');
  console.log(`Examples: "tomorrow", "next friday", "${sampleFormatted}" (use your local date format), "in 3 days"`);
  const dateInput = await askQuestion('Due date (press Enter to skip): ');
  
  if (!dateInput) {
    return null;
  }
  
  // Parse using helper that respects locale and common natural language tokens
  const parseResult = parseDateInput(dateInput, locale);
  let dueDate = parseResult ? new Date(parseResult) : null;
  
  if (!dueDate) {
    console.log('⚠️  Could not parse date, skipping due date');
    return null;
  }
  
  // Set time to end of day (23:59)
  dueDate.setHours(23, 59, 59, 999);
  
  console.log(`✅ Due date set: ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}`);
  return dueDate.toISOString();
}

/**
 * Confirm an action with y/n prompt
 */
export async function confirm(message, defaultYes = false) {
  const defaultText = defaultYes ? ' (Y/n)' : ' (y/N)';
  const answer = await askQuestion(`${message}${defaultText}: `);
  
  if (!answer) {
    return defaultYes;
  }
  
  return answer.toLowerCase().startsWith('y');
}

/**
 * Ask for Planka authorization details in sequence
 */
// Masked password input helper (preserves existing if provided)
export async function askForPassword(existingPwd) {
  if (existingPwd) {
    const ans = await askQuestion('Enter Planka password (press Enter to keep existing): ');
    return ans || existingPwd;
  }

  // Masked input for new password
  const rl = createReadlineInterface();
  const stdin = process.stdin;2

  return await new Promise((resolve) => {
    rl.output.write('Enter Planka password: ');
    try {
      if (stdin.isTTY) stdin.setRawMode(true);
    } catch (e) {
      // ignore if not TTY
    }
    let passwordChars = '';
    function onData(chunk) {
      const char = chunk.toString('utf8');
      if (char === '\r' || char === '\n') {
        stdin.removeListener('data', onData);
        try { if (stdin.isTTY) stdin.setRawMode(false); } catch (e) {}
        rl.output.write('\n');
        rl.close();
        resolve(passwordChars);
      } else if (char === '\u0003') { // ctrl-c
        stdin.removeListener('data', onData);
        try { if (stdin.isTTY) stdin.setRawMode(false); } catch (e) {}
        rl.close();
        process.exit();
      } else if (char === '\u0008' || char === '\u007f') { // backspace
        passwordChars = passwordChars.slice(0, -1);
        rl.output.write('\b \b');
      } else {
        passwordChars += char;
        rl.output.write('*');
      }
    }
    stdin.on('data', onData);
  });
}

/**
 * Parse date input with locale-aware numeric parsing and some natural language
 * Returns an ISO date-time string (end of day) or null
 */
function parseDateInput(text, locale = 'en-US') {
  if (!text) return null;
  const input = String(text).trim().toLowerCase();

  // Natural language shortcuts
  if (input === 'today') return new Date();
  if (input === 'tomorrow') {
    const d = new Date(); d.setDate(d.getDate() + 1); return d;
  }
  if (input.startsWith('in ') && input.includes('day')) {
    const days = parseInt(input.match(/\d+/)?.[0] || '0', 10);
    if (days > 0) { const d = new Date(); d.setDate(d.getDate() + days); return d; }
  }

  // next <weekday>
  if (input.startsWith('next ')) {
    const dayName = input.replace('next ', '').trim();
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const idx = days.findIndex(d => d.startsWith(dayName.substring(0,3)));
    if (idx !== -1) {
      const d = new Date();
      const current = d.getDay();
      const add = (idx - current + 7) % 7 || 7;
      d.setDate(d.getDate() + add);
      return d;
    }
  }

  // Try ISO parse
  const isoParsed = new Date(text);
  if (!isNaN(isoParsed.getTime())) return isoParsed;

  // Try locale-specific numeric date parsing (common: dd.MM.yyyy or MM/dd/yyyy)
  // Identify common separators
  const sepMatch = text.match(/[.\/\-]/);
  if (sepMatch) {
    const sep = sepMatch[0];
    const parts = text.split(sep).map(p => p.trim());
    // Accept dd.mm.yyyy or dd.mm.yy when locale uses day-month-year
    // Heuristic: locales starting with 'de' typically use day-month-year
    const dayFirst = /^de|^fr|^es|^it|^nl|^pt/i.test(locale);
    if (parts.length >= 2) {
      let day, month, year;
      if (dayFirst) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parts[2] ? parseInt(parts[2], 10) : (new Date()).getFullYear();
      } else {
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parts[2] ? parseInt(parts[2], 10) : (new Date()).getFullYear();
      }

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        // Support two-digit years
        if (year < 100) year += 2000;
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

// Export parser for use by non-interactive flows
export { parseDateInput };

/**
 * Ask for Planka authorization details in sequence (baseURL, username, password or token)
 * Shows existing values as defaults when provided via the `existing` object.
 */
export async function askForAuthorization(existing = {}) {
  const existingBase = existing.PLANKA_API_URL ? String(existing.PLANKA_API_URL).replace(/\/api\/?$/i, '') : undefined;

  // baseURL: require non-empty
  let baseURL = '';
  while (true) {
    baseURL = await askForInput('Enter Planka API URL (e.g., https://example.com)', existingBase || '');
    if (!baseURL) {
      console.log('❌ URL cannot be empty.');
      continue;
    }
    if (!/^https?:\/\//i.test(baseURL)) {
      console.log('❌ Please enter a valid URL starting with http:// or https://');
      continue;
    }
    break;
  }

  const username = await askForInput('Enter Planka username', existing.PLANKA_USERNAME || '');
  const password = await askForPassword(existing.PLANKA_PASSWORD);

  return { baseURL, username, password };
}

// Export parseDateInput for testing and programmatic usage
export { parseDateInput };