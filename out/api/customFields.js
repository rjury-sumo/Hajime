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
exports.CustomFieldsClient = void 0;
const client_1 = require("./client");
/**
 * Client for Sumo Logic Custom Fields API
 * Endpoint: GET /api/v1/fields
 * Docs: https://api.sumologic.com/docs/#operation/listCustomFields
 */
class CustomFieldsClient extends client_1.SumoLogicClient {
    /**
     * List all custom fields
     * Requires: Manage fields capability
     */
    listCustomFields() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.makeRequest(CustomFieldsClient.CUSTOM_FIELDS_API, 'GET');
        });
    }
    /**
     * Extract field names from custom fields response
     */
    static extractFieldNames(response) {
        if (!response || !response.data) {
            return [];
        }
        return response.data.map(field => field.fieldName);
    }
}
exports.CustomFieldsClient = CustomFieldsClient;
CustomFieldsClient.CUSTOM_FIELDS_API = '/api/v1/fields';
//# sourceMappingURL=customFields.js.map