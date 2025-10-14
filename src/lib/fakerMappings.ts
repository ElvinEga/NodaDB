import { faker } from '@faker-js/faker';
import { TableColumn } from '@/types';

export type FakerCategory =
  | 'person'
  | 'address'
  | 'internet'
  | 'phone'
  | 'company'
  | 'commerce'
  | 'date'
  | 'number'
  | 'text'
  | 'boolean'
  | 'uuid'
  | 'custom';

export interface FakerMethod {
  category: FakerCategory;
  method: string;
  displayName: string;
  generate: () => any;
}

export const FAKER_METHODS: Record<string, FakerMethod[]> = {
  person: [
    {
      category: 'person',
      method: 'fullName',
      displayName: 'Full Name',
      generate: () => faker.person.fullName(),
    },
    {
      category: 'person',
      method: 'firstName',
      displayName: 'First Name',
      generate: () => faker.person.firstName(),
    },
    {
      category: 'person',
      method: 'lastName',
      displayName: 'Last Name',
      generate: () => faker.person.lastName(),
    },
    {
      category: 'person',
      method: 'jobTitle',
      displayName: 'Job Title',
      generate: () => faker.person.jobTitle(),
    },
    {
      category: 'person',
      method: 'bio',
      displayName: 'Biography',
      generate: () => faker.person.bio(),
    },
  ],
  address: [
    {
      category: 'address',
      method: 'streetAddress',
      displayName: 'Street Address',
      generate: () => faker.location.streetAddress(),
    },
    {
      category: 'address',
      method: 'city',
      displayName: 'City',
      generate: () => faker.location.city(),
    },
    {
      category: 'address',
      method: 'state',
      displayName: 'State',
      generate: () => faker.location.state(),
    },
    {
      category: 'address',
      method: 'zipCode',
      displayName: 'ZIP Code',
      generate: () => faker.location.zipCode(),
    },
    {
      category: 'address',
      method: 'country',
      displayName: 'Country',
      generate: () => faker.location.country(),
    },
    {
      category: 'address',
      method: 'countryCode',
      displayName: 'Country Code',
      generate: () => faker.location.countryCode(),
    },
  ],
  internet: [
    {
      category: 'internet',
      method: 'email',
      displayName: 'Email',
      generate: () => faker.internet.email(),
    },
    {
      category: 'internet',
      method: 'username',
      displayName: 'Username',
      generate: () => faker.internet.username(),
    },
    {
      category: 'internet',
      method: 'url',
      displayName: 'URL',
      generate: () => faker.internet.url(),
    },
    {
      category: 'internet',
      method: 'domainName',
      displayName: 'Domain Name',
      generate: () => faker.internet.domainName(),
    },
    {
      category: 'internet',
      method: 'ipv4',
      displayName: 'IPv4 Address',
      generate: () => faker.internet.ipv4(),
    },
    {
      category: 'internet',
      method: 'ipv6',
      displayName: 'IPv6 Address',
      generate: () => faker.internet.ipv6(),
    },
    {
      category: 'internet',
      method: 'userAgent',
      displayName: 'User Agent',
      generate: () => faker.internet.userAgent(),
    },
  ],
  phone: [
    {
      category: 'phone',
      method: 'phoneNumber',
      displayName: 'Phone Number',
      generate: () => faker.phone.number(),
    },
    {
      category: 'phone',
      method: 'imei',
      displayName: 'IMEI',
      generate: () => faker.phone.imei(),
    },
  ],
  company: [
    {
      category: 'company',
      method: 'companyName',
      displayName: 'Company Name',
      generate: () => faker.company.name(),
    },
    {
      category: 'company',
      method: 'catchPhrase',
      displayName: 'Catch Phrase',
      generate: () => faker.company.catchPhrase(),
    },
    {
      category: 'company',
      method: 'department',
      displayName: 'Department',
      generate: () => faker.commerce.department(),
    },
  ],
  commerce: [
    {
      category: 'commerce',
      method: 'productName',
      displayName: 'Product Name',
      generate: () => faker.commerce.productName(),
    },
    {
      category: 'commerce',
      method: 'productDescription',
      displayName: 'Product Description',
      generate: () => faker.commerce.productDescription(),
    },
    {
      category: 'commerce',
      method: 'price',
      displayName: 'Price',
      generate: () => parseFloat(faker.commerce.price()),
    },
    {
      category: 'commerce',
      method: 'department',
      displayName: 'Department',
      generate: () => faker.commerce.department(),
    },
  ],
  date: [
    {
      category: 'date',
      method: 'past',
      displayName: 'Past Date',
      generate: () => faker.date.past().toISOString(),
    },
    {
      category: 'date',
      method: 'future',
      displayName: 'Future Date',
      generate: () => faker.date.future().toISOString(),
    },
    {
      category: 'date',
      method: 'recent',
      displayName: 'Recent Date',
      generate: () => faker.date.recent().toISOString(),
    },
    {
      category: 'date',
      method: 'birthdate',
      displayName: 'Birthdate',
      generate: () => faker.date.birthdate().toISOString(),
    },
  ],
  number: [
    {
      category: 'number',
      method: 'int',
      displayName: 'Integer (1-1000)',
      generate: () => faker.number.int({ min: 1, max: 1000 }),
    },
    {
      category: 'number',
      method: 'intSmall',
      displayName: 'Small Integer (1-100)',
      generate: () => faker.number.int({ min: 1, max: 100 }),
    },
    {
      category: 'number',
      method: 'intLarge',
      displayName: 'Large Integer (1-1000000)',
      generate: () => faker.number.int({ min: 1, max: 1000000 }),
    },
    {
      category: 'number',
      method: 'float',
      displayName: 'Float (0-1000)',
      generate: () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    },
  ],
  text: [
    {
      category: 'text',
      method: 'word',
      displayName: 'Word',
      generate: () => faker.lorem.word(),
    },
    {
      category: 'text',
      method: 'words',
      displayName: 'Words (3-5)',
      generate: () => faker.lorem.words(faker.number.int({ min: 3, max: 5 })),
    },
    {
      category: 'text',
      method: 'sentence',
      displayName: 'Sentence',
      generate: () => faker.lorem.sentence(),
    },
    {
      category: 'text',
      method: 'paragraph',
      displayName: 'Paragraph',
      generate: () => faker.lorem.paragraph(),
    },
    {
      category: 'text',
      method: 'slug',
      displayName: 'Slug',
      generate: () => faker.lorem.slug(),
    },
  ],
  boolean: [
    {
      category: 'boolean',
      method: 'boolean',
      displayName: 'Boolean',
      generate: () => faker.datatype.boolean(),
    },
  ],
  uuid: [
    {
      category: 'uuid',
      method: 'uuid',
      displayName: 'UUID',
      generate: () => faker.string.uuid(),
    },
  ],
};

// Get all faker methods as a flat list
export function getAllFakerMethods(): FakerMethod[] {
  return Object.values(FAKER_METHODS).flat();
}

// Smart column name detection
export function detectFakerMethodFromColumnName(columnName: string): FakerMethod | null {
  const name = columnName.toLowerCase();

  // Email patterns
  if (name.includes('email') || name.includes('e_mail')) {
    return FAKER_METHODS.internet.find(m => m.method === 'email') || null;
  }

  // Name patterns
  if (name.includes('firstname') || name.includes('first_name') || name === 'fname') {
    return FAKER_METHODS.person.find(m => m.method === 'firstName') || null;
  }
  if (name.includes('lastname') || name.includes('last_name') || name === 'lname') {
    return FAKER_METHODS.person.find(m => m.method === 'lastName') || null;
  }
  if (name.includes('fullname') || name.includes('full_name') || name === 'name') {
    return FAKER_METHODS.person.find(m => m.method === 'fullName') || null;
  }

  // Phone patterns
  if (name.includes('phone') || name.includes('mobile') || name.includes('tel')) {
    return FAKER_METHODS.phone.find(m => m.method === 'phoneNumber') || null;
  }

  // Address patterns
  if (name.includes('street') || name.includes('address')) {
    return FAKER_METHODS.address.find(m => m.method === 'streetAddress') || null;
  }
  if (name.includes('city')) {
    return FAKER_METHODS.address.find(m => m.method === 'city') || null;
  }
  if (name.includes('state') || name.includes('province')) {
    return FAKER_METHODS.address.find(m => m.method === 'state') || null;
  }
  if (name.includes('zip') || name.includes('postal')) {
    return FAKER_METHODS.address.find(m => m.method === 'zipCode') || null;
  }
  if (name.includes('country')) {
    return FAKER_METHODS.address.find(m => m.method === 'country') || null;
  }

  // Internet patterns
  if (name.includes('username') || name.includes('user_name') || name.includes('login')) {
    return FAKER_METHODS.internet.find(m => m.method === 'username') || null;
  }
  if (name.includes('url') || name.includes('website')) {
    return FAKER_METHODS.internet.find(m => m.method === 'url') || null;
  }
  if (name.includes('domain')) {
    return FAKER_METHODS.internet.find(m => m.method === 'domainName') || null;
  }
  if (name.includes('ip') || name.includes('ipaddress')) {
    return FAKER_METHODS.internet.find(m => m.method === 'ipv4') || null;
  }

  // Company patterns
  if (name.includes('company') || name.includes('organization')) {
    return FAKER_METHODS.company.find(m => m.method === 'companyName') || null;
  }
  if (name.includes('job') || name.includes('title') || name.includes('position')) {
    return FAKER_METHODS.person.find(m => m.method === 'jobTitle') || null;
  }
  if (name.includes('department') || name.includes('dept')) {
    return FAKER_METHODS.company.find(m => m.method === 'department') || null;
  }

  // Commerce patterns
  if (name.includes('product')) {
    return FAKER_METHODS.commerce.find(m => m.method === 'productName') || null;
  }
  if (name.includes('price') || name.includes('amount') || name.includes('cost')) {
    return FAKER_METHODS.commerce.find(m => m.method === 'price') || null;
  }

  // Date patterns
  if (name.includes('birth') || name.includes('dob')) {
    return FAKER_METHODS.date.find(m => m.method === 'birthdate') || null;
  }
  if (name.includes('date') || name.includes('created') || name.includes('updated')) {
    return FAKER_METHODS.date.find(m => m.method === 'recent') || null;
  }

  // Text patterns
  if (name.includes('description') || name.includes('bio') || name.includes('about')) {
    return FAKER_METHODS.text.find(m => m.method === 'paragraph') || null;
  }
  if (name.includes('title') || name.includes('heading')) {
    return FAKER_METHODS.text.find(m => m.method === 'sentence') || null;
  }
  if (name.includes('slug')) {
    return FAKER_METHODS.text.find(m => m.method === 'slug') || null;
  }

  // Boolean patterns
  if (name.includes('is_') || name.includes('has_') || name.includes('active') || name.includes('enabled')) {
    return FAKER_METHODS.boolean.find(m => m.method === 'boolean') || null;
  }

  // UUID patterns
  if (name.includes('uuid') || name.includes('guid')) {
    return FAKER_METHODS.uuid.find(m => m.method === 'uuid') || null;
  }

  return null;
}

// Smart data type detection
export function detectFakerMethodFromDataType(dataType: string): FakerMethod | null {
  const type = dataType.toLowerCase();

  // Integer types
  if (type.includes('int') || type.includes('integer') || type.includes('bigint') || type.includes('smallint')) {
    return FAKER_METHODS.number.find(m => m.method === 'int') || null;
  }

  // Float/Decimal types
  if (type.includes('float') || type.includes('double') || type.includes('decimal') || type.includes('numeric') || type.includes('real')) {
    return FAKER_METHODS.number.find(m => m.method === 'float') || null;
  }

  // Boolean types
  if (type.includes('bool') || type.includes('bit')) {
    return FAKER_METHODS.boolean.find(m => m.method === 'boolean') || null;
  }

  // Date/Time types
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return FAKER_METHODS.date.find(m => m.method === 'recent') || null;
  }

  // Text types - default to sentence for shorter fields, paragraph for longer
  if (type.includes('char') || type.includes('varchar') || type.includes('text')) {
    // Check length if available
    const lengthMatch = type.match(/\((\d+)\)/);
    if (lengthMatch) {
      const length = parseInt(lengthMatch[1]);
      if (length <= 50) {
        return FAKER_METHODS.text.find(m => m.method === 'words') || null;
      } else if (length <= 255) {
        return FAKER_METHODS.text.find(m => m.method === 'sentence') || null;
      }
    }
    return FAKER_METHODS.text.find(m => m.method === 'paragraph') || null;
  }

  // UUID types
  if (type.includes('uuid') || type.includes('guid')) {
    return FAKER_METHODS.uuid.find(m => m.method === 'uuid') || null;
  }

  // Default to text
  return FAKER_METHODS.text.find(m => m.method === 'sentence') || null;
}

// Auto-detect best faker method for a column
export function autoDetectFakerMethod(column: TableColumn): FakerMethod {
  // Skip primary key columns
  if (column.is_primary_key) {
    return FAKER_METHODS.number.find(m => m.method === 'int')!;
  }

  // First try to detect from column name (more specific)
  const nameMethod = detectFakerMethodFromColumnName(column.name);
  if (nameMethod) {
    return nameMethod;
  }

  // Fall back to data type detection
  const typeMethod = detectFakerMethodFromDataType(column.data_type);
  if (typeMethod) {
    return typeMethod;
  }

  // Ultimate fallback
  return FAKER_METHODS.text.find(m => m.method === 'sentence')!;
}

// Generate data for a column
export function generateColumnData(
  column: TableColumn,
  fakerMethod: FakerMethod,
  respectNullable: boolean = true
): any {
  // Handle nullable fields (10% chance of null)
  if (respectNullable && column.is_nullable && Math.random() < 0.1) {
    return null;
  }

  // Generate the value
  return fakerMethod.generate();
}

// Generate multiple rows of data
export function generateRows(
  columns: TableColumn[],
  fakerMethods: Map<string, FakerMethod>,
  rowCount: number
): Record<string, any>[] {
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, any> = {};

    for (const column of columns) {
      // Skip auto-increment primary keys
      if (column.is_primary_key && (
        column.data_type.toLowerCase().includes('serial') ||
        column.default_value?.toLowerCase().includes('autoincrement') ||
        column.default_value?.toLowerCase().includes('identity')
      )) {
        continue;
      }

      const method = fakerMethods.get(column.name);
      if (method) {
        row[column.name] = generateColumnData(column, method);
      }
    }

    rows.push(row);
  }

  return rows;
}
