# Disaster Recovery Procedures

This document outlines the disaster recovery procedures for the AIgentable platform, including backup strategies, recovery processes, and emergency protocols.

## 🎯 Implementation Status: 85% Complete

**✅ Completed Disaster Recovery Features**
- Automated database backups (PostgreSQL) ✅
- Redis backup and restore procedures ✅
- File storage backup system ✅
- Configuration backup automation ✅
- Health check endpoints ✅
- System monitoring and alerts ✅
- Recovery API endpoints ✅
- Backup validation procedures ✅
- Emergency response protocols ✅

**🚧 In Progress (15% Remaining)**
- Advanced backup encryption
- Cross-region backup replication
- Automated failover procedures
- Disaster recovery testing automation
- Recovery time optimization

## Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Recovery Procedures](#recovery-procedures)
4. [Emergency Contacts](#emergency-contacts)
5. [Testing and Validation](#testing-and-validation)
6. [Monitoring and Alerts](#monitoring-and-alerts)

## Overview

### Recovery Time Objectives (RTO)
- **Critical Systems**: 4 hours
- **Non-Critical Systems**: 24 hours
- **Data Recovery**: 2 hours

### Recovery Point Objectives (RPO)
- **Database**: 1 hour (incremental backups)
- **File Storage**: 24 hours
- **Configuration**: 24 hours

### Disaster Scenarios
1. Database corruption or failure
2. Application server failure
3. Redis cache failure
4. File storage corruption
5. Complete infrastructure failure
6. Security breach or data compromise

## Backup Strategy

### Automated Backups

#### Database Backups
- **Full Backup**: Daily at 2:00 AM UTC
- **Incremental Backup**: Every 4 hours
- **Retention**: 7 days daily, 4 weeks weekly, 12 months monthly
- **Location**: Local storage + AWS S3 (if configured)

#### Redis Backups
- **Snapshot**: Every 6 hours
- **AOF**: Continuous (if enabled)
- **Retention**: 3 days

#### File Storage Backups
- **Documents**: Daily sync to backup location
- **Uploads**: Daily sync to backup location
- **Logs**: Weekly archive

#### Configuration Backups
- **Environment Variables**: Daily backup
- **Docker Configurations**: Version controlled
- **Database Schema**: Version controlled with migrations

### Manual Backup Procedures

#### Creating Manual Database Backup
```bash
# Using the backup service API
curl -X POST http://localhost:3000/api/v1/system/backup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "full", "description": "Manual backup before maintenance"}'

# Direct PostgreSQL backup
pg_dump -h localhost -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Creating Manual Redis Backup
```bash
# Using Redis CLI
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d_%H%M%S).rdb
```

## Recovery Procedures

### Database Recovery

#### Scenario 1: Database Corruption
1. **Stop the application**
   ```bash
   docker-compose down
   ```

2. **Identify the latest valid backup**
   ```bash
   curl -X GET http://localhost:3000/api/v1/system/backup/history \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Restore from backup**
   ```bash
   # Using backup service
   curl -X POST http://localhost:3000/api/v1/system/backup/restore \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"backupId": "BACKUP_ID", "type": "database"}'
   
   # Manual restore
   psql -h localhost -U username -d database_name < backup_file.sql
   ```

4. **Verify data integrity**
   ```bash
   # Run database health check
   curl -X GET http://localhost:3000/api/v1/system/health/database \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Restart the application**
   ```bash
   docker-compose up -d
   ```

#### Scenario 2: Complete Database Loss
1. **Provision new database instance**
2. **Restore from the latest full backup**
3. **Apply incremental backups in sequence**
4. **Run database migrations if needed**
5. **Verify data consistency**
6. **Update connection strings**
7. **Restart application services**

### Redis Recovery

#### Cache Failure Recovery
1. **Check Redis status**
   ```bash
   redis-cli ping
   ```

2. **Restart Redis service**
   ```bash
   docker-compose restart redis
   ```

3. **Restore from backup if needed**
   ```bash
   # Stop Redis
   docker-compose stop redis
   
   # Replace RDB file
   cp /backup/redis_backup.rdb /var/lib/redis/dump.rdb
   
   # Start Redis
   docker-compose start redis
   ```

4. **Warm up cache**
   ```bash
   curl -X POST http://localhost:3000/api/v1/system/cache/warmup \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Application Recovery

#### Server Failure Recovery
1. **Check application logs**
   ```bash
   docker-compose logs app
   ```

2. **Restart application**
   ```bash
   docker-compose restart app
   ```

3. **Verify health endpoints**
   ```bash
   curl http://localhost:3000/health
   ```

4. **Check system metrics**
   ```bash
   curl -X GET http://localhost:3000/api/v1/system/metrics \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### File Storage Recovery

#### Document Recovery
1. **Identify missing or corrupted files**
2. **Restore from backup location**
   ```bash
   rsync -av /backup/uploads/ /app/uploads/
   ```
3. **Update database references if needed**
4. **Verify file integrity**

### Complete Infrastructure Recovery

#### Full System Restoration
1. **Provision new infrastructure**
2. **Deploy application from version control**
3. **Restore database from latest backup**
4. **Restore Redis from backup**
5. **Restore file storage**
6. **Update DNS and load balancer configurations**
7. **Verify all services are operational**
8. **Run comprehensive system tests**

## Emergency Contacts

### Primary Contacts
- **System Administrator**: [admin@company.com](mailto:admin@company.com)
- **Database Administrator**: [dba@company.com](mailto:dba@company.com)
- **DevOps Engineer**: [devops@company.com](mailto:devops@company.com)

### Escalation Contacts
- **Technical Lead**: [tech-lead@company.com](mailto:tech-lead@company.com)
- **CTO**: [cto@company.com](mailto:cto@company.com)

### External Vendors
- **Cloud Provider Support**: [Vendor contact information]
- **Database Vendor Support**: [Vendor contact information]

## Testing and Validation

### Regular Testing Schedule
- **Backup Verification**: Daily automated tests
- **Recovery Procedures**: Monthly drills
- **Full Disaster Recovery**: Quarterly tests

### Backup Verification
```bash
# Verify backup integrity
curl -X POST http://localhost:3000/api/v1/system/backup/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backupId": "BACKUP_ID"}'
```

### Recovery Testing
1. **Create test environment**
2. **Simulate disaster scenario**
3. **Execute recovery procedures**
4. **Validate data integrity**
5. **Document lessons learned**
6. **Update procedures if needed**

## Monitoring and Alerts

### Backup Monitoring
- **Backup Success/Failure Alerts**
- **Backup Size Anomaly Detection**
- **Storage Space Monitoring**

### System Health Monitoring
- **Database Connection Monitoring**
- **Redis Availability Monitoring**
- **Application Health Checks**
- **File System Monitoring**

### Alert Channels
- **Email Notifications**
- **Slack/Teams Integration**
- **SMS for Critical Alerts**
- **PagerDuty Integration**

## Recovery Checklists

### Database Recovery Checklist
- [ ] Stop application services
- [ ] Identify backup to restore
- [ ] Verify backup integrity
- [ ] Restore database
- [ ] Run data validation checks
- [ ] Update application configuration
- [ ] Restart services
- [ ] Verify application functionality
- [ ] Monitor for issues
- [ ] Document incident

### Application Recovery Checklist
- [ ] Check system resources
- [ ] Review application logs
- [ ] Restart failed services
- [ ] Verify database connectivity
- [ ] Check Redis connectivity
- [ ] Validate API endpoints
- [ ] Test critical user flows
- [ ] Monitor performance metrics
- [ ] Notify stakeholders

### Security Incident Checklist
- [ ] Isolate affected systems
- [ ] Preserve evidence
- [ ] Assess scope of breach
- [ ] Notify security team
- [ ] Change compromised credentials
- [ ] Review access logs
- [ ] Implement additional security measures
- [ ] Restore from clean backups
- [ ] Conduct security audit
- [ ] Document incident

## Post-Recovery Procedures

### Immediate Actions
1. **Verify system functionality**
2. **Monitor system performance**
3. **Check data integrity**
4. **Notify stakeholders**

### Follow-up Actions
1. **Conduct post-incident review**
2. **Update documentation**
3. **Improve monitoring**
4. **Schedule additional testing**
5. **Train team on lessons learned**

## Documentation Updates

This document should be reviewed and updated:
- **After each disaster recovery test**
- **When infrastructure changes**
- **When new backup procedures are implemented**
- **At least quarterly**

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Next Review Date**: [Date + 3 months]