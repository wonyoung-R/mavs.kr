#!/usr/bin/env node

/**
 * API Testing Script for MAVS.KR
 *
 * This script tests all the API endpoints to ensure they're working correctly.
 * Run with: npm run test:api
 */

import axios from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL';
  responseTime: number;
  error?: string;
  data?: any;
}

class APITester {
  private results: TestResult[] = [];

  async testEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    headers?: Record<string, string>
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const response = await axios({
        method,
        url: `${BASE_URL}${endpoint}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 10000,
      });

      const responseTime = Date.now() - startTime;

      const result: TestResult = {
        endpoint,
        method,
        status: 'PASS',
        responseTime,
        data: response.data,
      };

      this.results.push(result);
      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      const result: TestResult = {
        endpoint,
        method,
        status: 'FAIL',
        responseTime,
        error: error.response?.data?.message || error.message,
      };

      this.results.push(result);
      return result;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting API Tests...\n');

    // Test Games API
    console.log('📊 Testing Games API...');
    await this.testEndpoint('/games/live');
    await this.testEndpoint('/games/schedule');
    await this.testEndpoint('/games/schedule?days=14');

    // Test News API
    console.log('📰 Testing News API...');
    await this.testEndpoint('/news/crawl');

    // Test Cron Jobs (with auth)
    console.log('⏰ Testing Cron Jobs...');
    const cronHeaders = {
      'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
    };

    await this.testEndpoint('/cron/crawl-news', 'GET', undefined, cronHeaders);
    await this.testEndpoint('/cron/update-games', 'GET', undefined, cronHeaders);

    // Print Results
    this.printResults();
  }

  printResults() {
    console.log('\n📋 Test Results Summary:');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${total}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    console.log('\n📝 Detailed Results:');
    console.log('-'.repeat(60));

    this.results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      const time = `${result.responseTime}ms`;

      console.log(`${status} ${result.method} ${result.endpoint} (${time})`);

      if (result.status === 'FAIL' && result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.data && result.data.success !== undefined) {
        console.log(`   Success: ${result.data.success}`);
      }
    });

    // Performance Analysis
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / total;
    const slowestEndpoint = this.results.reduce((slowest, current) =>
      current.responseTime > slowest.responseTime ? current : slowest
    );

    console.log('\n⚡ Performance Analysis:');
    console.log(`📊 Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`🐌 Slowest Endpoint: ${slowestEndpoint.endpoint} (${slowestEndpoint.responseTime}ms)`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (failed > 0) {
      console.log('🔧 Fix failing endpoints before deployment');
    }
    if (avgResponseTime > 2000) {
      console.log('⚡ Consider optimizing slow endpoints');
    }
    if (passed === total) {
      console.log('🎉 All tests passed! Ready for deployment');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests().catch(console.error);
}

export default APITester;

