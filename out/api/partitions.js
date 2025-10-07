"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartitionsClient = void 0;
const client_1 = require("./client");
/**
 * Client for Sumo Logic Partitions API
 * Endpoint: GET /api/v1/partitions
 * Docs: https://api.sumologic.com/docs/#operation/listPartitions
 */
class PartitionsClient extends client_1.SumoLogicClient {
    /**
     * List all partitions
     * Requires: View Partitions capability
     */
    listPartitions() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(PartitionsClient.PARTITIONS_API, 'GET');
        });
    }
    /**
     * Extract partition names from partitions response
     */
    static extractPartitionNames(response) {
        if (!response || !response.data) {
            return [];
        }
        return response.data.map(partition => partition.name);
    }
    /**
     * Format partitions as a readable table
     */
    static formatPartitionsAsTable(partitions) {
        if (partitions.length === 0) {
            return 'No partitions found';
        }
        // Calculate column widths
        const nameWidth = Math.max(15, ...partitions.map(p => p.name.length));
        const expressionWidth = Math.min(50, Math.max(20, ...partitions.map(p => p.routingExpression.length)));
        const retentionWidth = 10;
        const statusWidth = 8;
        // Create header
        let table = '';
        table += 'Name'.padEnd(nameWidth) + ' | ';
        table += 'Routing Expression'.padEnd(expressionWidth) + ' | ';
        table += 'Retention'.padEnd(retentionWidth) + ' | ';
        table += 'Active'.padEnd(statusWidth) + '\n';
        table += '-'.repeat(nameWidth) + '-+-';
        table += '-'.repeat(expressionWidth) + '-+-';
        table += '-'.repeat(retentionWidth) + '-+-';
        table += '-'.repeat(statusWidth) + '\n';
        // Create rows
        partitions.forEach(partition => {
            table += partition.name.padEnd(nameWidth) + ' | ';
            table += partition.routingExpression.substring(0, 50).padEnd(expressionWidth) + ' | ';
            table += `${partition.retentionPeriod}d`.padEnd(retentionWidth) + ' | ';
            table += (partition.isActive ? 'Yes' : 'No').padEnd(statusWidth) + '\n';
        });
        return table;
    }
}
exports.PartitionsClient = PartitionsClient;
PartitionsClient.PARTITIONS_API = '/api/v1/partitions';
//# sourceMappingURL=partitions.js.map