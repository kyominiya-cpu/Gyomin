#!/usr/bin/perl
# 인사이트 텍스트 파일 + 메타데이터(환경변수)로 Notion 페이지 생성용 JSON을 만든다.
# JSON 문자열 이스케이프를 안전하게 처리.
#
# 사용:  YT_TITLE=.. YT_CHANNEL=.. YT_URL=.. YT_THUMB=.. YT_TAGS=비즈니스 YT_DATE=2026-06-13 \
#        perl build_notion_page.pl <insight.txt>
use strict;
use warnings;
use utf8;                                   # 소스 내 한글 리터럴(제목/채널 등)을 UTF-8로
use Encode qw(decode_utf8);
binmode(STDOUT, ':encoding(UTF-8)');        # 출력도 UTF-8

sub env_u { return decode_utf8($ENV{$_[0]} // ""); }  # 환경변수를 UTF-8 char로

my $DB = $ENV{YT_DB} || "37e8dc08-cce8-812a-81d9-f1a94a18829b";

sub jesc {
    my $s = shift // "";
    $s =~ s/\\/\\\\/g;
    $s =~ s/"/\\"/g;
    $s =~ s/\r//g;
    $s =~ s/\n/\\n/g;
    $s =~ s/\t/\\t/g;
    return $s;
}

my $insight_file = $ARGV[0] or die "usage: build_notion_page.pl <insight.txt>\n";
open(my $f, '<:encoding(UTF-8)', $insight_file) or die "open $insight_file: $!\n";
local $/;
my $insight = <$f>;
close($f);
$insight =~ s/\s+$//;

my $title   = jesc(env_u("YT_TITLE"));
my $channel = jesc(env_u("YT_CHANNEL"));
my $url     = jesc(env_u("YT_URL"));
my $thumb   = jesc(env_u("YT_THUMB"));
my $date    = jesc(env_u("YT_DATE"));
my $ins     = jesc($insight);

# 태그: 콤마구분 → multi_select 항목
my @tags = grep { length } map { s/^\s+|\s+$//gr } split(/,/, env_u("YT_TAGS"));
my $tags_json = join(",", map { '{"name":"' . jesc($_) . '"}' } @tags);

print <<"JSON";
{
  "parent": {"database_id": "$DB"},
  "properties": {
    "제목":   {"title":[{"text":{"content":"$title"}}]},
    "채널":   {"rich_text":[{"text":{"content":"$channel"}}]},
    "URL":    {"url":"$url"},
    "썸네일": {"files":[{"type":"external","name":"thumbnail.jpg","external":{"url":"$thumb"}}]},
    "인사이트":{"rich_text":[{"text":{"content":"$ins"}}]},
    "태그":   {"multi_select":[$tags_json]},
    "저장일": {"date":{"start":"$date"}}
  }
}
JSON
