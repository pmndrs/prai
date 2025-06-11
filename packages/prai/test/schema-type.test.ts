import { describe, expect, it } from 'vitest'
import { object, lazy, Schema, string, number, boolean, array, literal, union, intersection } from 'zod'
import { buildSchemaType } from '../src/schema/type.js'

type X = {
  x?: X
}

const x: Schema<X> = object({
  x: lazy(() => x),
})

describe('schema typescript', () => {
  // Current test for recursive schemas
  it('should generate typescript for recursive schemas', () => {
    expect(buildSchemaType(x, 'X', {})).to.equal(`type X = {\n\tx: X\n}\n`)
  })

  it('should generate typescript for recursive schemas with type name', () => {
    expect(buildSchemaType(x, 'User', {})).to.equal(`type User = {\n\tx: User\n}\n`)
  })

  // Basic primitive schema types
  it('should generate typescript for string schema', () => {
    const schema = string()
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = string\n')
  })

  it('should generate typescript for string schema with type name', () => {
    const schema = string()
    expect(buildSchemaType(schema, 'MyString', {})).to.equal('type MyString = string\n')
  })

  it('should generate typescript for number schema', () => {
    const schema = number()
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = number\n')
  })

  it('should generate typescript for boolean schema', () => {
    const schema = boolean()
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = boolean\n')
  })

  // Array schemas
  it('should generate typescript for array schema with primitive elements', () => {
    const schema = array(string())
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = Array<string>\n')
  })

  it('should generate typescript for array schema with object elements', () => {
    const schema = array(object({ name: string(), age: number() }))
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = Array<{\n\tname: string\n\tage: number\n}>\n')
  })

  // Object schemas
  it('should generate typescript for object schema with multiple fields', () => {
    const schema = object({
      name: string(),
      age: number(),
      isActive: boolean(),
    })
    expect(buildSchemaType(schema, 'X', {})).to.equal(
      'type X = {\n\tname: string\n\tage: number\n\tisActive: boolean\n}\n',
    )
  })

  it('should generate typescript for object schema with a single field', () => {
    const schema = object({ name: string() })
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = {\n\tname: string\n}\n')
  })

  // Nullable schemas
  it('should generate typescript for a nullable schema', () => {
    const schema = string().nullable()
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = string | null\n')
  })

  it('should generate typescript for object with nullable fields', () => {
    const schema = object({
      name: string(),
      age: number().nullable(),
    })
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = {\n\tname: string\n\tage: number | null\n}\n')
  })

  // Literal schemas
  it('should generate typescript for string literal schema', () => {
    const schema = literal('admin')
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = "admin"\n')
  })

  it('should generate typescript for number literal schema', () => {
    const schema = literal(42)
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = 42\n')
  })

  it('should generate typescript for boolean literal schema', () => {
    const schema = literal(true)
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = true\n')
  })

  // Union schemas
  it('should generate typescript for union of primitive schemas', () => {
    const schema = union([string(), number()])
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = string | number\n')
  })

  it('should generate typescript for union of literals', () => {
    const schema = union([literal('admin'), literal('user'), literal('guest')])
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = "admin" | "user" | "guest"\n')
  })

  // Nested objects
  it('should generate typescript for nested object schemas', () => {
    const schema = object({
      user: object({
        name: string(),
        contact: object({
          email: string(),
          phone: string().nullable(),
        }),
      }),
    })
    expect(buildSchemaType(schema, 'X', {})).to.equal(
      'type X = {\n\tuser: {\n\t\tname: string\n\t\tcontact: {\n\t\t\temail: string\n\t\t\tphone: string | null\n\t\t}\n\t}\n}\n',
    )
  })

  // Intersection of objects
  it('should generate typescript for intersection of objects', () => {
    const personSchema = object({ name: string(), age: number() })
    const employeeSchema = object({ company: string(), salary: number() })
    const schema = intersection(personSchema, employeeSchema)

    expect(buildSchemaType(schema, 'X', {})).to.equal(
      'type X = {\n\tname: string\n\tage: number\n\tcompany: string\n\tsalary: number\n}\n',
    )
  })

  // Complex example with multiple features
  it('should generate typescript for complex schema with multiple features', () => {
    const addressSchema = object({
      street: string(),
      city: string(),
      zip: string(),
    })

    const userSchema = object({
      id: string(),
      name: string(),
      age: number().nullable(),
      addresses: array(addressSchema),
      role: union([literal('admin'), literal('user'), literal('guest')]),
    })

    const result = buildSchemaType(userSchema, 'X', {})
    expect(result).to.be.a('string').and.not.to.be.empty
    // This complex schema's exact output may change, so we just check if it contains key TypeScript elements
    expect(result).to.include('id: string')
    expect(result).to.include('name: string')
    expect(result).to.include('age: number | null')
    expect(result).to.include('addresses: Array<')
    expect(result).to.include('role: "admin" | "user" | "guest"')
  })

  // Test with type names
  it('should generate typescript with type name for complex schema', () => {
    const schema = object({
      name: string(),
      age: number(),
    })

    expect(buildSchemaType(schema, 'Person', {})).to.equal('type Person = {\n\tname: string\n\tage: number\n}\n')
  })

  // Test lazy schemas
  it('should generate typescript for lazy schemas', () => {
    const schema = lazy(() => string())
    expect(buildSchemaType(schema, 'X', {})).to.equal('type X = string\n')
  })

  // Test enum-like unions
  it('should generate typescript for enum-like unions with type name', () => {
    const schema = union([literal('read'), literal('write'), literal('admin')])
    expect(buildSchemaType(schema, 'Permission', {})).to.equal('type Permission = "read" | "write" | "admin"\n')
  })

  // Description tests
  describe('schema descriptions', () => {
    it('should include descriptions as comments for primitive types', () => {
      const schema = string().describe('A user name')
      expect(buildSchemaType(schema, 'UserName', {})).to.equal('/* A user name */\ntype UserName = string\n')
    })

    it('should include descriptions as comments for objects', () => {
      const schema = object({
        name: string().describe('The user full name'),
        age: number().describe('The user age in years'),
      }).describe('A user object containing personal information')

      const result = buildSchemaType(schema, 'User', {})
      expect(result).to.include('/* A user object containing personal information */')
      expect(result).to.include('/* The user full name */')
      expect(result).to.include('name:')
      expect(result).to.include('/* The user age in years */')
      expect(result).to.include('age:')
    })

    it('should include descriptions for arrays', () => {
      const schema = array(string().describe('A tag name')).describe('List of user tags')
      const result = buildSchemaType(schema, 'Tags', {})
      expect(result).to.equal('/* List of user tags */\ntype Tags = Array</* A tag name */ string>\n')
    })

    it('should include descriptions for unions', () => {
      const schema = union([
        literal('admin').describe('Administrator role'),
        literal('user').describe('Regular user role'),
      ]).describe('User role type')
      const result = buildSchemaType(schema, 'Role', {})
      expect(result).to.include('/* User role type */')
      expect(result).to.include('"admin"')
      expect(result).to.include('"user"')
    })

    it('should include descriptions for literals', () => {
      const schema = literal('production').describe('Production environment')
      const result = buildSchemaType(schema, 'Env', {})
      expect(result).to.equal('/* Production environment */\ntype Env = "production"\n')
    })

    it('should work with nested object descriptions', () => {
      const schema = object({
        profile: object({
          firstName: string().describe('First name'),
          lastName: string().describe('Last name'),
        }).describe('User profile information'),
        settings: object({
          theme: string().describe('UI theme preference'),
        }).describe('User settings'),
      }).describe('Complete user data')

      const result = buildSchemaType(schema, 'UserData', {})
      expect(result).to.include('/* Complete user data */')
      expect(result).to.include('/* User profile information */')
      expect(result).to.include('/* First name */')
      expect(result).to.include('/* Last name */')
      expect(result).to.include('/* User settings */')
      expect(result).to.include('/* UI theme preference */')
    })

    it('should work without descriptions (no comments)', () => {
      const schema = object({
        name: string(),
        age: number(),
      })

      const result = buildSchemaType(schema, 'User', {})
      expect(result).not.to.include('/*')
      expect(result).not.to.include('*/')
      expect(result).to.equal('type User = {\n\tname: string\n\tage: number\n}\n')
    })

    it('should handle mixed described and non-described fields', () => {
      const schema = object({
        name: string().describe('User name'),
        age: number(), // no description
        email: string().describe('Email address'),
      })

      const result = buildSchemaType(schema, 'User', {})
      expect(result).to.include('/* User name */')
      expect(result).to.include('name:')
      expect(result).to.include('age: number') // no comment
      expect(result).to.include('/* Email address */')
      expect(result).to.include('email:')
    })

    it('should work with nullable described fields', () => {
      const schema = string().nullable().describe('Optional user bio')
      const result = buildSchemaType(schema, 'Bio', {})
      expect(result).to.equal('/* Optional user bio */\ntype Bio = string | null\n')
    })

    it('should work with intersection descriptions', () => {
      const personSchema = object({
        name: string().describe('Person name'),
        age: number().describe('Person age'),
      }).describe('Basic person info')

      const employeeSchema = object({
        company: string().describe('Company name'),
        salary: number().describe('Annual salary'),
      }).describe('Employment info')

      const schema = intersection(personSchema, employeeSchema)
      const result = buildSchemaType(schema, 'Employee', {})

      expect(result).to.include('/* Person name */')
      expect(result).to.include('/* Person age */')
      expect(result).to.include('/* Company name */')
      expect(result).to.include('/* Annual salary */')
    })
  })
})
