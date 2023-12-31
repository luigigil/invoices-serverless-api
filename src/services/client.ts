import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, UpdateItemCommandOutput, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Client } from '../models'

export default class ClientService {
  constructor(
    private readonly dynamoClient: DynamoDBClient,
    private readonly tableName: string,
  ) { }

  async getAllClients(): Promise<Client[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    try {
      const response = await this.dynamoClient.send(command);

      if (response.Items == null) {
        throw new Error('Error getting clients');
      }

      const unmarshalled: Client[] = response.Items.map(item => unmarshall(item) as unknown as Client);

      return unmarshalled;
    } catch (error) {
      throw error;
    }
  }

  async createClient(client: Client): Promise<Client> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(client),
    });

    try {
      await this.dynamoClient.send(command);

      return client;
    } catch (error) {
      throw error;
    }
  }

  async getClient(id: string): Promise<Client> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        clientId: { S: id },
      },
    });

    try {
      const response = await this.dynamoClient.send(command);

      // if item does not exist
      if (!response.Item) {
        return null
      }

      const unmarshalled = unmarshall(response.Item) as unknown as Client;

      return unmarshalled
    } catch (error) {
      throw error;
    }
  }

  async updateClient({ id, client }: { id: string, client: Partial<Client> }): Promise<Client> {
    const expressionAttributeValues: any = {};
    const updateExpression: string[] = []
    const expressionAttributeNames: any = {};

    if (client.name) {
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = { S: client.name };
      updateExpression.push('#name = :name');
    }

    if (client.email) {
      expressionAttributeValues[':email'] = { S: client.email };
      updateExpression.push('email = :email');
    }

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: {
        clientId: { S: id },
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    let response: UpdateItemCommandOutput
    try {
      response = await this.dynamoClient.send(command);
    } catch (error) {
      throw error;
    }

    const unmarshalled = unmarshall(response.Attributes) as unknown as Client;

    return unmarshalled
  }

  async deleteClient(id: string): Promise<Client> {
    const deletedAt = new Date().toISOString();

    // soft delete so invoices can still have a client reference
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: {
        clientId: { S: id },
      },
      UpdateExpression: `SET deletedAt = :deletedAt`,
      ExpressionAttributeValues: {
        ':deletedAt': { S: deletedAt },
      },
      ReturnValues: 'ALL_NEW',
    });

    try {
      const response = await this.dynamoClient.send(command);

      const deletedClient = unmarshall(response.Attributes) as unknown as Client;

      // deleted at should be set
      if (deletedClient.deletedAt == null) {
        throw new Error('Error deleting client')
      }

      return deletedClient
    } catch (error) {
      throw error;
    }
  }
}
