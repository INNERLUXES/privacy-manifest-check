#import <Foundation/Foundation.h>

// Older code of the orders app, kept in Objective-C.
@interface OrderSync : NSObject
- (NSDate *)lastSyncDate;
- (NSDate *)modifiedAtOfFile:(NSString *)path;
@end

@implementation OrderSync

- (NSDate *)lastSyncDate {
    return [[NSUserDefaults standardUserDefaults] objectForKey:@"lastSyncDate"];
}

- (NSDate *)modifiedAtOfFile:(NSString *)path {
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
    return attributes[NSFileModificationDate];
}

@end
