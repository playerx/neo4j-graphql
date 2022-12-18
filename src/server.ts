import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { Neo4jGraphQL } from '@neo4j/graphql'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import neo4j from 'neo4j-driver'
import { AuthJWTPlugin } from './helpers/AuthJWTPlugin'

require('dotenv').config()

const {
  NEO4J_ADDRESS = '',
  NEO4J_USERNAME = '',
  NEO4J_PASSWORD = '',
  JOK_ACCOUNT_SEED = '',
} = process.env

// The GraphQL schema
const typeDefs = `
    type User {
      id: ID! @id
      name: String!
      sessions: [UserSession!]! @relationship(type: "HAS_SESSION", direction: OUT)
      email: String
      walletAddress: String
      tokens: Int!              @default(value: 0)
      status: UserStatus!
      otpSecret: String!        @private

      """
      *VIP Membership* information. User can read *only own data*. Admin can do all type of operation.
      """
      vip: VIPMembership        @relationship(type: "HAS_MEMBERSHIP", direction: OUT)

      updatedAt: DateTime       @timestamp(operations: [UPDATE])
      createdAt: DateTime!      @timestamp(operations: [CREATE])
    }

    type VIPMembership {
      id: ID! @id
      user: User! @relationship(type: "HAS_MEMBERSHIP", direction: IN)
      expiresAt: DateTime!
      createdAt: DateTime!      @timestamp(operations: [CREATE])
    }

    type UserSession {
      id: ID! @id
      user: User!               @relationship(type: "HAS_SESSION", direction: IN)
      platform: Platform!
      deviceName: String

      createdAt: DateTime!      @timestamp(operations: [CREATE])
    }

    enum UserStatus {
      GUEST
      VERIFIED
    }

    enum Platform {
      IOS
      ANDROID
      WEB
    }

    type Game {
      id: ID! @id
      name: String!

      updatedAt: DateTime       @timestamp(operations: [UPDATE])
      createdAt: DateTime!      @timestamp(operations: [CREATE])
    }

    type GameRoom {
      id: ID! @id
      game: Game!               @relationship(type: "PLAYED_GAME", direction: OUT)
      config: String            
      viewers: [User!]!         @relationship(type: "WATCHED_AT", direction: IN)
      players: [User!]!         @relationship(type: "PLAYED_AT", direction: IN)

      nextRoom: GameRoom        @relationship(type: "NEXT_PLAYED_AT", direction: OUT)

      updatedAt: DateTime       @timestamp(operations: [UPDATE])
      createdAt: DateTime!      @timestamp(operations: [CREATE])
    }


    # Permissions -----------------------------------------------------
    extend type User @auth(
      rules: [
        { roles: ["ADMIN"] },
        {
          where: { id: "$jwt.jok.userId" }
          operations: [READ]
        },
      ]
    )

    extend type UserSession @auth(
      rules: [
        { roles: "ADMIN" }
      ]
    )

    extend type VIPMembership @auth(
      rules: [
        { roles: ["ADMIN"] },
        {
          allow: { user: { id: "$jwt.jok.userId" } }
          operations: [READ]
        }
      ]
    )

    extend type Game @auth(
      rules: [
        { roles: "ADMIN" }
      ]
    )

    extend type GameRoom @auth(
      rules: [
        { roles: "ADMIN" }
      ]
    )
`

const resolvers = {}

const driver = neo4j.driver(
  NEO4J_ADDRESS,
  neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
)

const neoSchema = new Neo4jGraphQL({
  typeDefs,
  driver,
  resolvers,
  plugins: {
    auth: new AuthJWTPlugin({
      isGlobalAuthenticationEnabled: true,
      rolesPath: 'jok.roles',
      seed: JOK_ACCOUNT_SEED,
    }),
  },
})

neoSchema.getSchema().then(async schema => {
  const server = new ApolloServer({
    schema,
  })

  await server.start()

  const app = express()

  app.use(
    '/',
    cors<cors.CorsRequest>(),
    bodyParser.json({ limit: '2mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => ({ req }),
    })
  )

  await new Promise<void>(resolve =>
    app.listen({ port: 4000 }, resolve)
  )

  console.log(`🚀 Server ready at http://localhost:4000`)
})
