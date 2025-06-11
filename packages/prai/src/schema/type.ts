import {
  Schema,
  ZodArray,
  ZodBoolean,
  ZodEnum,
  ZodIntersection,
  ZodLazy,
  ZodLiteral,
  ZodNumber,
  ZodObject,
  ZodNullable,
  ZodString,
  ZodUnion,
} from 'zod'
import { flattenIntersections } from './utils.js'
import { SchemaVisitor } from './visitor.js'
import { ReusedSchemaVisitor } from './reused.js'
import { Biome, Distribution } from '@biomejs/js-api'

const biome = await Biome.create({
  distribution: Distribution.NODE,
})
biome.applyConfiguration({
  javascript: {
    formatter: {
      semicolons: 'asNeeded',
      indentWidth: 1,
    },
  },
})

export interface SchemaTypeOptions {
  /** Used schemas set for sharing across multiple calls */
  usedSchemas?: Set<Schema>
  /** External map of schema to type name for sharing definitions across history */
  schemaTypeDefinitions?: Map<Schema, string>
  /** Prefix for generated type names */
  prefix?: string
}

class TypeSchemaVisitor extends SchemaVisitor<string, [forceTypeName?: string, skipComment?: boolean]> {
  public typeDefinitions: string[] = []
  private typeNameCounter = 0

  constructor(
    private readonly reusedSchemas: ReadonlySet<Schema>,
    private readonly schemaTypeDefinitions: Map<Schema, string>,
    private readonly typeNamePrefix: string,
  ) {
    super()
  }

  visit(schema: Schema, forceTypeName?: string, skipComment = false): string {
    // If schema is already in schemaTypeDefinitions, return the stored type (no comment)
    const existingTypeName = this.schemaTypeDefinitions.get(schema)

    if (forceTypeName != null) {
      const typeName = this.typeNamePrefix + forceTypeName
      if (existingTypeName != null) {
        return `type ${typeName} = ${existingTypeName}`
      }
      this.schemaTypeDefinitions.set(schema, typeName)
      return addComment(`type ${typeName} = ${super.visit(schema, undefined, true)}`, schema, false, '\n')
    }

    if (existingTypeName != null) {
      return existingTypeName
    }

    // If schema is in reusedSchemas, create a type name and store definition (no comment when referencing)
    if (this.reusedSchemas.has(schema)) {
      const typeName = this.typeNamePrefix + this.generateTypeName()
      this.schemaTypeDefinitions.set(schema, typeName)
      this.typeDefinitions.push(
        addComment(`type ${typeName} = ${super.visit(schema, undefined, true)}`, schema, false, '\n'),
      )
      return typeName
    }

    return addComment(super.visit(schema), schema, skipComment, ' ')
  }

  visitArray(schema: ZodArray<any>): string {
    const elementType = this.visit(schema.element)
    return `Array<${elementType}>`
  }

  visitBoolean(schema: ZodBoolean): string {
    return 'boolean'
  }

  visitEnum(schema: ZodEnum<any>): string {
    const enumValues = (schema.options as Array<string>).map((value) => `"${value}"`).join(' | ')
    return `(${enumValues})`
  }

  visitIntersection(schema: ZodIntersection<any, any>): string {
    const intersections = flattenIntersections(schema)
    const unsupportedSchema = intersections.find((intersectionSchema) => !(intersectionSchema instanceof ZodObject))
    if (unsupportedSchema != null) {
      throw new Error(
        `unsupported schema type "${unsupportedSchema.constructor.name}" inside intersection. Only objects allowed.`,
      )
    }
    const entries = (intersections as Array<ZodObject<any>>).reduce<Array<[string, Schema]>>(
      (prev, intersectionSchema) => prev.concat(Object.entries(intersectionSchema.shape)),
      [],
    )
    return this.buildObjectSchemaTypescriptFromShape(entries)
  }

  visitLazy(schema: ZodLazy<any>): string {
    return this.visit(schema.schema)
  }

  visitLiteral(schema: ZodLiteral<any>): string {
    let literalValue: string
    switch (typeof schema.value) {
      case 'string':
        literalValue = `"${schema.value}"`
        break
      case 'number':
      case 'boolean':
        literalValue = `${schema.value}`
        break
      default:
        throw new Error(`literal of type "${typeof schema.value}" is not supported`)
    }
    return literalValue
  }

  visitNumber(): string {
    return 'number'
  }

  visitObject(schema: ZodObject<any>): string {
    return this.buildObjectSchemaTypescriptFromShape(Object.entries<Schema>(schema.shape))
  }

  visitNullable(schema: ZodNullable<any>): string {
    const innerType = this.visit(schema.unwrap())
    return `(${innerType} | null)`
  }

  visitString(): string {
    return 'string'
  }

  visitUnion(schema: ZodUnion<any>): string {
    if (!Array.isArray(schema.options)) {
      throw new Error(`the options in the union schema must be in an array`)
    }
    const unionTypes = schema.options.map((option) => this.visit(option)).join(' | ')
    return `(${unionTypes})`
  }

  private buildObjectSchemaTypescriptFromShape(shapeEntries: Array<[string, Schema]>): string {
    const fieldDefinitions = shapeEntries.map(([key, entry]) => {
      // Add comments before the field for objects, but skip comment when getting field type
      const fieldType = this.visit(entry, undefined, true)
      return addComment(`"${key}": ${fieldType}`, entry, this.reusedSchemas.has(entry), '\n')
    })

    return fieldDefinitions.length > 0 ? `{\n${fieldDefinitions.join(',\n')}\n}` : '{}'
  }

  private generateTypeName(): string {
    const i = this.typeNameCounter++
    let result = ''
    let num = i
    while (num >= 26) {
      const rest = num % 26
      result = String.fromCharCode(65 + rest) + result
      num = (num - rest) / 26 - 1
    }
    result = String.fromCharCode(65 + num) + result
    return `Type${result}`
  }
}

function addComment(result: string, schema: Schema, skipComment: boolean, seperatingWhitespace: string): string {
  if (skipComment || schema.description == null) {
    return result
  }
  return `/* ${schema.description} */${seperatingWhitespace}${result}`
}

export function buildSchemaType(
  schema: Schema,
  typeName: string,
  { prefix = '', schemaTypeDefinitions = new Map(), usedSchemas = new Set() }: SchemaTypeOptions = {},
): string {
  // Build the reused schemas set using ReusedSchemaVisitor
  const reusedSchemaVisitor = new ReusedSchemaVisitor(usedSchemas)
  reusedSchemaVisitor.visit(schema)

  // Create TypeSchemaVisitor with reused schemas and schema type definitions
  const typeVisitor = new TypeSchemaVisitor(reusedSchemaVisitor.reusedSchemas, schemaTypeDefinitions, prefix)

  // Visit the main schema
  const mainType = typeVisitor.visit(schema, typeName)

  // Combine type definitions with main type
  const allDefinitions = [...typeVisitor.typeDefinitions, mainType]
  return biome.formatContent(allDefinitions.join('\n'), { filePath: 'example.ts' }).content
}
