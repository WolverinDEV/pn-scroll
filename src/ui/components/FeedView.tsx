import {
    BlogProvider,
    FeedEntry,
    FeedProvider,
    PostImage,
} from "../../engine";
import React, {useContext, useEffect, useRef, useState} from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text, TouchableHighlight, TouchableWithoutFeedback,
    View,
} from "react-native";
import {useObjectReducer} from "../hooks/ObjectReducer";
import {AppSettings, Setting} from "../../Settings";
import {ImageRenderer} from "./PostImage";
import {SearchBar} from "./SearchBar";
import {TopBarHeader} from "./TopBar";
import {useHistory} from "react-router-native";
import {BidirectionalFlatList} from "./flat-list";
import {getLogger, logComponentRendered} from "../../Log";
import {executeRequest} from "../../engine/request";

const FeedEntryContext = React.createContext<{
    item: FeedEntry,
    visible: boolean,
    index: number,
    itemHeight: number
}>(undefined as any);

const logger = getLogger("feed-view");

export type FeedInfo = {
    feed: FeedProvider,
    blog: BlogProvider,
    blogName: string
};

const FeedInfoContext = React.createContext<FeedInfo>(undefined as any);

const FeedLoadingFooter = () => {
    return (
        <View
            style={{
                position: 'relative',
                width: "100%",
                height: 100,
                paddingVertical: 20,
                marginTop: 10,
                marginBottom: 10,

                justifyContent: "center",
            }}
        >
            <ActivityIndicator animating size={40} />
        </View>
    );
};

const style = StyleSheet.create({
    absoluteImage: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    }
});

const PostImageRenderer = React.memo((props: { image: PostImage, withPreview?: boolean }) => {
    const { visible } = useContext(FeedEntryContext);
    const { blog } = useContext(FeedInfoContext);

    const previewImage = props.image.preview || props.image.detailed;
    if(!previewImage) {
        return (
            <Text>Invalid image!</Text>
        );
    }

    const hqImage = props.image.detailed;
    const [ hqImageLoaded, setHqImageLoaded ] = useState(false);

    let images = [];

    if(!hqImage || previewImage === hqImage) {
        images.push(
            <ImageRenderer
                key={"single"}
                style={{ height: "100%", width: "100%" }}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    } else {
        images.push(
            <ImageRenderer
                key={"preview"}
                style={[style.absoluteImage, { opacity: AppSettings.getValue(Setting.PreviewOpacity) }]}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    }

    if(visible) {
        images.push(
            <ImageRenderer
                key={"hq"}
                style={[style.absoluteImage, { opacity: hqImageLoaded ? 1 : 0 }]}
                source={hqImage}
                resizeMode={"contain"}

                onLoad={() => setHqImageLoaded(true)}
                blog={blog}
            />
        );
    }

    let body = (
        <View
            key={"body"}
            style={{ position: "absolute", height: "100%", width: "100%" }}
        >
            {images}
        </View>
    );

    if(props.withPreview) {
        return (
            <TouchableWithoutFeedback
                key={"touch"}
                onPress={() => {
                    if(!props.withPreview) {
                        return;
                    }

                    /* TODO: Render a <ImagePreview /> ! */
                    //setImagePreview(hqImage || previewImage);
                }}
            >
                {body}
            </TouchableWithoutFeedback>
        );
    } else {
        return body;
    }
});

const FeedEntryImageRenderer = React.memo(() => {
    const { item, itemHeight } = useContext(FeedEntryContext);
    if(item.type !== "image") {
        throw "item type must be an image";
    }

    const [ expanded, setExpanded ] = useState(false);

    if(item.images.length === 0) {
        return null;
    } else if(item.images.length === 1) {
        return (
            <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
                <PostImageRenderer image={item.images[0]} withPreview />
            </View>
        );
    }

    if(expanded) {
        return (
            <View key={"expanded"}>
                {item.images.map((image, index) => (
                    <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-" + index}>
                        <PostImageRenderer image={image} withPreview />
                    </View>
                ))}
            </View>
        );
    } else {
        return (
            <TouchableHighlight
                style={{
                    marginTop: 5,
                    marginBottom: 5,
                    height: itemHeight,
                    width: "100%",
                    borderWidth: 2,
                    borderColor: "blue",
                    borderRadius: 2
                }}
                key={"image-not-expended"}
                onPress={() => {
                    setExpanded(!expanded);
                    logger.debug("Expending post.");
                }}
            >
                <View style={{
                    height: "100%",
                    width: "100%"
                }}>
                    <PostImageRenderer image={item.images[0]} withPreview={false} />
                </View>
            </TouchableHighlight>
        );
    }
});

const FeedEntryPHVideoRenderer = React.memo(() => {
    const { item, itemHeight } = useContext(FeedEntryContext);
    if(item.type !== "ph-video") {
        throw "item type must be a ph-video";
    }

    /*
     * FIXME: 1. React native fixup!
     *        2. Play preview video on touch/hover
     */
    // //`https://www.pornhub.com/view_video.php?viewkey=${item.viewKey}`
    // const frameRef = useRef<HTMLIFrameElement>(null);
    // useEffect(() => {
    //     const frame = frameRef.current!;
    //     const document = frame.contentWindow?.document || frame.contentDocument;
    //     document!.write(`
    //     <script>
    //         console.log("Hello World");
    //         fetch("https://teaspeak.de/");
    //     </script>
    //     `);
    // }, [ frameRef ]);
    // return (
    //     <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
    //         <iframe ref={frameRef} src={"/empty-page"} />
    //     </View>
    // );
    const refContainer = useRef<HTMLDivElement>(null);
    // useEffect(() => {
    //     (async () => {
    //         const response = await executeRequest({ type: "GET", url: `https://www.pornhub.com/view_video.php?viewkey=${item.viewKey}`, responseType: "text" });
    //         if(response.status !== "success") {
    //             console.error(response);
    //             return;
    //         }
    //
    //         let htmlText = response.payload;
    //
    //         /* No, we don't want your service worker. */
    //         htmlText = htmlText.replace(/'serviceWorker' in navigator/g, "false");
    //         /* We don't want a domain redirect. */
    //         htmlText = htmlText.replace(/isInWhitelist:/g, "isInWhitelist: () => true, _isInWhitelist:");
    //         htmlText = `
    //         <video-element
    //                 platform="desktop"
    //                 platform-fallback="desktop"
    //                 unique-id="playerDiv_382864362"
    //                 data-attributes='{"showEnlargeButton":true,"showAutoplayOption":true,"showShare":1,"showNextVideoOption":true}'
    //         ></video-element>
    //         <script>
    //             let page_params  = {};
    //             let playerObjList = {};
    //
    //             var flashvars_382864362 = {"experimentId":"experimentId unknown","searchEngineData":null,"maxInitialBufferLength":10,"disable_sharebar":0,"htmlPauseRoll":"true","htmlPostRoll":"true","autoplay":"true","autoreplay":"false","video_unavailable":"false","pauseroll_url":"","postroll_url":"","embedCode":"<iframe src=\\"https:\\/\\/www.pornhub.com\\/embed\\/ph60192e1696c77\\" frameborder=\\"0\\" width=\\"560\\" height=\\"340\\" scrolling=\\"no\\" allowfullscreen><\\/iframe>","hidePostPauseRoll":false,"isHD":"true","video_duration":"388","actionTags":"Doggystyle:3,Blowjob:170,Missionary:195,Doggystyle:227,Missionary:281,Cum In Mouth:320","link_url":"https:\\/\\/www.pornhub.com\\/view_video.php?viewkey=ph60192e1696c77","related_url":"https:\\/\\/www.pornhub.com\\/video\\/player_related_datas?id=382864362","image_url":"https:\\/\\/ei.phncdn.com\\/videos\\/202102\\/02\\/382864362\\/original\\/(m=qLGV6JWbeaAaGwObaaaa)(mh=5Q6jkx6kRsANSI_H)0.jpg","video_title":"18 Yo Super Petite Newbie Mia Loves it ROUGH - First Time Porn \\/ First Big Cock \\/ First Hard Sex \u00b4","defaultQuality":[720,480,240,1080],"vcServerUrl":"\\/svvt\\/add?stype=svv&svalue=382864362&snonce=acwcfnfgellxrkza&skey=81c914378868c4aa8ab60435def1046f2db1f4bd03d32012b2fdca50d11988e9&stime=1639333921","mediaPriority":"hls","mediaDefinitions":[{"defaultQuality":false,"format":"hls","videoUrl":"","quality":"1080"},{"defaultQuality":false,"format":"hls","videoUrl":"","quality":"240"},{"defaultQuality":false,"format":"hls","videoUrl":"","quality":"480"},{"defaultQuality":true,"format":"hls","videoUrl":"","quality":"720"},{"defaultQuality":720,"format":"hls","videoUrl":"","quality":[1080,720,480,240]},{"defaultQuality":false,"format":"mp4","videoUrl":"","quality":[],"remote":true},{"defaultQuality":false,"format":"upsell","videoUrl":"","quality":"1440"},{"defaultQuality":false,"format":"upsell","videoUrl":"","quality":"2160"}],"isVertical":"false","video_unavailable_country":"false","mp4_seek":"ms","hotspots":["122040","85310","76620","74008","71697","70991","68552","66926","67109","67231","66873","66077","65910","64922","63434","63719","63246","61287","61028","60295","59543","59943","61052","61165","60393","59575","58064","58956","59381","62018","61879","61632","58840","58821","59060","54482","50811","51782","54736","59505","60207","57760","56741","57266","56989","57968","58109","58002","59194","62266","63138","62913","62693","60782","59829","58662","57964","55658","53308","51696","50575","49417","49166","51183","51657","50352","47440","44385","41747","40365","38878","37866","36945","34838","32551","29030","25272","32309"],"toprated_url":"https:\\/\\/www.pornhub.com\\/video?o=tr&t=m","mostviewed_url":"https:\\/\\/www.pornhub.com\\/video?o=mv&t=m","options":"show","cdn":"haproxy","startLagThreshold":1000,"outBufferLagThreshold":2000,"appId":"1111","service":"protrack","cdnProvider":"ht","tubesCmsPrerollConfigType":"new","prerollGlobalConfig":{"delay":[900,2000,3000],"forgetUserAfter":1,"onNth":0,"skipDelay":4,"skippable":true,"vastSkipDelay":false,"vast":"https:\\/\\/www.pornhub.com\\/_xa\\/ads?zone_id=1845481&site_id=2&channel%5Bcontext_tag%5D=rough%2Cbig-cock%2Cpetite%2Cnatural-tits%2Crough-doggystyle%2Chomemade%2Ccum-in-mouth%2Cfemale-orgasm%2Chair-pulling%2Cshaved-pussy%2Cdoggy-style&channel%5Bcontext_category%5D=Amateur%2CBig-Dick%2CBlowjob%2CCumshot%2CHardcore%2CTeen-%2818%2B%29%2CRed-Head%2CRough-Sex%2CVerified-Amateurs&channel%5Bcontext_pornstar%5D=&channel%5Binfo%5D=%7B%22actor_id%22%3A1071626352%2C%22content_type%22%3A%22model%22%2C%22video_id%22%3A382864362%2C%22session_id%22%3A%22%22%2C%22timestamp%22%3A1639333921%2C%22hash%22%3A%22da763283cce27f13c7b30eac424fc69c%22%7D&cache=1639333921&t_version=2021121008.ded7795&channel%5Bsite%5D=pornhub","user_accept_language":"en-GB,en-US;q=0.9,en;q=0.8"},"thumbs":{"samplingFrequency":4,"type":"normal","cdnType":"regular","urlPattern":"https:\\/\\/ei.phncdn.com\\/videos\\/202102\\/02\\/382864362\\/timeline\\/160x90\\/(m=eGCaiCObaaaa)(mh=PZpXSPMmZgxmS_-J)S{3}.jpg","thumbHeight":"90","thumbWidth":"160"},"nextVideo":{"thumb":"https:\\/\\/ei.phncdn.com\\/videos\\/201810\\/04\\/186028941\\/original\\/(m=ecuKGgaaaa)(mh=rov1AnqEzeAQ0ZoL)16.jpg","duration":"331","title":" Tiny Redhead Dolly Little Gets Absolutely Wrecked","isHD":"1","nextUrl":"\\/view_video.php?viewkey=ph5bb642f720e40","video":"","vkey":"ph5bb642f720e40","isJoinPageEntry":false,"channelTitle":"Aggressive Porn","views":"2.6M","viewsText":"views","rating":73,"uploaderLink":"<a href=\\"\\/channels\\/aggressiveporn\\" class=\\"bolded\\">Aggressive Porn<\\/a>","badge":"channel-icon"},"language":"en","isp":"vodafone germany dsl","geo":"germany","chromecast":true,"autoFullscreen":true};
    //             var player_mp4_seek = "ms";
    //             // var nextVideoObject = flashvars_['nextVideo'];
    //             var ra8643621ra29ra8643621ra29="864362/1";var ram3u8valra60ram3u8valra60="m3u8?val";var rahttpsra26rahttpsra26="https://";var ra080p400ra44ra080p400ra44="080P_" + "400";var rahxq3gfra84rahxq3gfra84="h=xQ3GF" + "%";var ra3dra30ra3dra30="3D";var ral1hasra92ral1hasra92="l=-1&" + "has";var ra7521ipara46ra7521ipara46="7521&ipa";var ra2ltnb1wsra14ra2ltnb1wsra14="2ltnB1W" + "s";var rao163933ra14rao163933ra14="o=163" + "933";var raos20210ra41raos20210ra41="os/20" + "210";var ra92725ra23ra92725ra23="=92.72.5";var ra2123hdra60ra2123hdra60="2.123&h" + "d";var ra2bwcud07ra33ra2bwcud07ra33="2BWCUd07";var ra63933032ra66ra63933032ra66="63933032";var ra0k38286ra81ra0k38286ra81="0K_38" + "286";var ra38jgerora21ra38jgerora21="38JGeRo" + "%";var ra1validtra56ra1validtra56="1&valid" + "t";var ra202382ra61ra202382ra61="2/02/382";var ra4362mp4ra35ra4362mp4ra35="4362.mp4";var raevhphnra84raevhphnra84="ev-h.phn";var racdncomra81racdncomra81="cdn.c" + "om/";var raidfrom1ra85raidfrom1ra85="idfro" + "m=1";var ramasterra79ramasterra79="/master" + ".";var rahlsvidera41rahlsvidera41="hls/vide";var media_0=/* + ram3u8valra60ram3u8valra60 + */rahttpsra26rahttpsra26 + /* + ra63933032ra66ra63933032ra66 + */raevhphnra84raevhphnra84 + /* + ra3dra30ra3dra30 + */racdncomra81racdncomra81 + /* + raidfrom1ra85raidfrom1ra85 + */rahlsvidera41rahlsvidera41 + /* + racdncomra81racdncomra81 + */raos20210ra41raos20210ra41 + /* + ramasterra79ramasterra79 + */ra202382ra61ra202382ra61 + /* + ra7521ipara46ra7521ipara46 + */ra8643621ra29ra8643621ra29 + /* + racdncomra81racdncomra81 + */ra080p400ra44ra080p400ra44 + /* + raidfrom1ra85raidfrom1ra85 + */ra0k38286ra81ra0k38286ra81 + /* + ramasterra79ramasterra79 + */ra4362mp4ra35ra4362mp4ra35 + /* + ra202382ra61ra202382ra61 + */ramasterra79ramasterra79 + /* + ra4362mp4ra35ra4362mp4ra35 + */ram3u8valra60ram3u8valra60 + /* + ra38jgerora21ra38jgerora21 + */raidfrom1ra85raidfrom1ra85 + /* + ram3u8valra60ram3u8valra60 + */ra63933032ra66ra63933032ra66 + /* + rao163933ra14rao163933ra14 + */ra1validtra56ra1validtra56 + /* + ra0k38286ra81ra0k38286ra81 + */rao163933ra14rao163933ra14 + /* + raidfrom1ra85raidfrom1ra85 + */ra7521ipara46ra7521ipara46 + /* + ra0k38286ra81ra0k38286ra81 + */ra92725ra23ra92725ra23 + /* + raidfrom1ra85raidfrom1ra85 + */ra2123hdra60ra2123hdra60 + /* + ral1hasra92ral1hasra92 + */ral1hasra92ral1hasra92 + /* + raos20210ra41raos20210ra41 + */rahxq3gfra84rahxq3gfra84 + /* + ra2ltnb1wsra14ra2ltnb1wsra14 + */ra2bwcud07ra33ra2bwcud07ra33 + /* + ra080p400ra44ra080p400ra44 + */ra2ltnb1wsra14ra2ltnb1wsra14 + /* + ra202382ra61ra202382ra61 + */ra38jgerora21ra38jgerora21 + /* + ra202382ra61ra202382ra61 + */ra3dra30ra3dra30;flashvars_382864362['mediaDefinitions'][0]['videoUrl'] = media_0;var ra8validfrra19ra8validfrra19="8?validfr";var ra123hdlra73ra123hdlra73=".123&hdl=";var ra927252ra34ra927252ra34="=92.72.52";var ravhphncdra10ravhphncdra10="v-h.phn" + "cd";var ravideos2ra81ravideos2ra81="/videos/2";var ralsa1hrke6ra88ralsa1hrke6ra88="lsA1HrKE6";var ra0k382864ra48ra0k382864ra48="0K_382864";var raom163933ra16raom163933ra16="om=163933";var ra382864362ra48ra382864362ra48="382864362";var raasterm3ura55raasterm3ura55="aster.m3u";var rafuc2f8wxra32rafuc2f8wxra32="fUC%2F8" + "Wx";var ra6txqmxhmbra99ra6txqmxhmbra99="6txQmXhmB";var ra362mp4mra21ra362mp4mra21="362.mp4/m";var ra240p100ra67ra240p100ra67="/240P_1" + "00";var ra37521ipara100ra37521ipara100="37521&ipa";var rahttpsera82rahttpsera82="https://e";var ra0321valira60ra0321valira60="0321&va" + "li";var ray3dra88ray3dra88="Y%3D";var ra1hashura89ra1hashura89="-1&hash" + "=u";var ra0210202ra50ra0210202ra50="02102/02/";var rancomhlsra82rancomhlsra82="n.com" + "/hls";var radto16393ra33radto16393ra33="dto=1" + "6393";var media_1=/* + rahttpsera82rahttpsera82 + */rahttpsera82rahttpsera82 + /* + raasterm3ura55raasterm3ura55 + */ravhphncdra10ravhphncdra10 + /* + ra0321valira60ra0321valira60 + */rancomhlsra82rancomhlsra82 + /* + ra6txqmxhmbra99ra6txqmxhmbra99 + */ravideos2ra81ravideos2ra81 + /* + ravideos2ra81ravideos2ra81 + */ra0210202ra50ra0210202ra50 + /* + ra382864362ra48ra382864362ra48 + */ra382864362ra48ra382864362ra48 + /* + ra37521ipara100ra37521ipara100 + */ra240p100ra67ra240p100ra67 + /* + ray3dra88ray3dra88 + */ra0k382864ra48ra0k382864ra48 + /* + ra8validfrra19ra8validfrra19 + */ra362mp4mra21ra362mp4mra21 + /* + ra362mp4mra21ra362mp4mra21 + */raasterm3ura55raasterm3ura55 + /* + radto16393ra33radto16393ra33 + */ra8validfrra19ra8validfrra19 + /* + ra8validfrra19ra8validfrra19 + */raom163933ra16raom163933ra16 + /* + ra382864362ra48ra382864362ra48 + */ra0321valira60ra0321valira60 + /* + rahttpsera82rahttpsera82 + */radto16393ra33radto16393ra33 + /* + ra362mp4mra21ra362mp4mra21 + */ra37521ipara100ra37521ipara100 + /* + ra0321valira60ra0321valira60 + */ra927252ra34ra927252ra34 + /* + ray3dra88ray3dra88 + */ra123hdlra73ra123hdlra73 + /* + radto16393ra33radto16393ra33 + */ra1hashura89ra1hashura89 + /* + rafuc2f8wxra32rafuc2f8wxra32 + */ralsa1hrke6ra88ralsa1hrke6ra88 + /* + ra382864362ra48ra382864362ra48 + */rafuc2f8wxra32rafuc2f8wxra32 + /* + radto16393ra33radto16393ra33 + */ra6txqmxhmbra99ra6txqmxhmbra99 + /* + ra8validfrra19ra8validfrra19 + */ray3dra88ray3dra88;flashvars_382864362['mediaDefinitions'][1]['videoUrl'] = media_1;var ra1hashura10ra1hashura10="-1&hash" + "=u";var ra8validfrra84ra8validfrra84="8?validfr";var ra927252ra61ra927252ra61="=92.72.52";var ravideos2ra91ravideos2ra91="/videos" + "/2";var ra2fx4c2bora22ra2fx4c2bora22="2Fx4C%2BO";var ra37521ipara62ra37521ipara62="37521&ipa";var ra123hdlra9ra123hdlra9=".123&" + "hdl=";var ra0210202ra28ra0210202ra28="02102/0" + "2/";var raom163933ra41raom163933ra41="om=1639" + "33";var ra382864362ra60ra382864362ra60="382864362";var raasterm3ura32raasterm3ura32="aster.m3u";var ratrw3kotzra22ratrw3kotzra22="TRw3KoTz%";var ra480p200ra39ra480p200ra39="/480P_200";var rancomhlsra66rancomhlsra66="n.com/hls";var ratqo3dra28ratqo3dra28="tQo%3D";var ra0321valira91ra0321valira91="0321&vali";var raonvcgmgvhra27raonvcgmgvhra27="OnVCGMgVh";var ra362mp4mra40ra362mp4mra40="362.mp4/m";var ra0k382864ra98ra0k382864ra98="0K_382864";var ravhphncdra67ravhphncdra67="v-h.phncd";var radto16393ra15radto16393ra15="dto=1" + "6393";var rahttpsera75rahttpsera75="https://e";var media_2=/* + ra0210202ra28ra0210202ra28 + */rahttpsera75rahttpsera75 + /* + ra927252ra61ra927252ra61 + */ravhphncdra67ravhphncdra67 + /* + ra1hashura10ra1hashura10 + */rancomhlsra66rancomhlsra66 + /* + rahttpsera75rahttpsera75 + */ravideos2ra91ravideos2ra91 + /* + ravideos2ra91ravideos2ra91 + */ra0210202ra28ra0210202ra28 + /* + ravideos2ra91ravideos2ra91 + */ra382864362ra60ra382864362ra60 + /* + ravideos2ra91ravideos2ra91 + */ra480p200ra39ra480p200ra39 + /* + ra927252ra61ra927252ra61 + */ra0k382864ra98ra0k382864ra98 + /* + ra0210202ra28ra0210202ra28 + */ra362mp4mra40ra362mp4mra40 + /* + ra1hashura10ra1hashura10 + */raasterm3ura32raasterm3ura32 + /* + radto16393ra15radto16393ra15 + */ra8validfrra84ra8validfrra84 + /* + ra0210202ra28ra0210202ra28 + */raom163933ra41raom163933ra41 + /* + ra2fx4c2bora22ra2fx4c2bora22 + */ra0321valira91ra0321valira91 + /* + rancomhlsra66rancomhlsra66 + */radto16393ra15radto16393ra15 + /* + ra0k382864ra98ra0k382864ra98 + */ra37521ipara62ra37521ipara62 + /* + radto16393ra15radto16393ra15 + */ra927252ra61ra927252ra61 + /* + ra480p200ra39ra480p200ra39 + */ra123hdlra9ra123hdlra9 + /* + ra480p200ra39ra480p200ra39 + */ra1hashura10ra1hashura10 + /* + ravideos2ra91ravideos2ra91 + */ratrw3kotzra22ratrw3kotzra22 + /* + ra1hashura10ra1hashura10 + */ra2fx4c2bora22ra2fx4c2bora22 + /* + ra37521ipara62ra37521ipara62 + */raonvcgmgvhra27raonvcgmgvhra27 + /* + raasterm3ura32raasterm3ura32 + */ratqo3dra28ratqo3dra28;flashvars_382864362['mediaDefinitions'][2]['videoUrl'] = media_2;var ra123hdlra45ra123hdlra45=".123&hd" + "l=";var ra362mp4mra31ra362mp4mra31="362.mp4/m";var ra0k382864ra49ra0k382864ra49="0K_382864";var rafzqlt4z85ra85rafzqlt4z85ra85="FZQlT" + "4Z85";var ra382864362ra30ra382864362ra30="382864362";var ra3bfjw8owra56ra3bfjw8owra56="3bFJw8o" + "w%";var ra0210202ra54ra0210202ra54="02102" + "/02/";var ra927252ra86ra927252ra86="=92.72.52";var raasterm3ura74raasterm3ura74="aster.m3u";var ra3dra91ra3dra91="3D";var ra0321valira10ra0321valira10="0321&vali";var ra37521ipara11ra37521ipara11="37521" + "&ipa";var raom163933ra34raom163933ra34="om=16" + "3933";var ravhphncdra76ravhphncdra76="v-h.phncd";var raiswqzj39era69raiswqzj39era69="IswQZJ39e";var ra8validfrra74ra8validfrra74="8?validfr";var rancomhlsra42rancomhlsra42="n.com/h" + "ls";var radto16393ra18radto16393ra18="dto=16393";var ra720p400ra96ra720p400ra96="/720P_400";var ravideos2ra72ravideos2ra72="/videos" + "/2";var rahttpsera42rahttpsera42="https:/" + "/e";var ra1hashera53ra1hashera53="-1&ha" + "sh=e";var media_3=/* + ra3bfjw8owra56ra3bfjw8owra56 + */rahttpsera42rahttpsera42 + /* + rancomhlsra42rancomhlsra42 + */ravhphncdra76ravhphncdra76 + /* + ra0210202ra54ra0210202ra54 + */rancomhlsra42rancomhlsra42 + /* + ravideos2ra72ravideos2ra72 + */ravideos2ra72ravideos2ra72 + /* + rancomhlsra42rancomhlsra42 + */ra0210202ra54ra0210202ra54 + /* + raom163933ra34raom163933ra34 + */ra382864362ra30ra382864362ra30 + /* + rafzqlt4z85ra85rafzqlt4z85ra85 + */ra720p400ra96ra720p400ra96 + /* + ra3dra91ra3dra91 + */ra0k382864ra49ra0k382864ra49 + /* + raasterm3ura74raasterm3ura74 + */ra362mp4mra31ra362mp4mra31 + /* + ra3dra91ra3dra91 + */raasterm3ura74raasterm3ura74 + /* + ra1hashera53ra1hashera53 + */ra8validfrra74ra8validfrra74 + /* + rahttpsera42rahttpsera42 + */raom163933ra34raom163933ra34 + /* + radto16393ra18radto16393ra18 + */ra0321valira10ra0321valira10 + /* + radto16393ra18radto16393ra18 + */radto16393ra18radto16393ra18 + /* + ra362mp4mra31ra362mp4mra31 + */ra37521ipara11ra37521ipara11 + /* + raiswqzj39era69raiswqzj39era69 + */ra927252ra86ra927252ra86 + /* + raiswqzj39era69raiswqzj39era69 + */ra123hdlra45ra123hdlra45 + /* + rahttpsera42rahttpsera42 + */ra1hashera53ra1hashera53 + /* + ra720p400ra96ra720p400ra96 + */rafzqlt4z85ra85rafzqlt4z85ra85 + /* + ra0k382864ra49ra0k382864ra49 + */raiswqzj39era69raiswqzj39era69 + /* + ra1hashera53ra1hashera53 + */ra3bfjw8owra56ra3bfjw8owra56 + /* + ra3bfjw8owra56ra3bfjw8owra56 + */ra3dra91ra3dra91;flashvars_382864362['mediaDefinitions'][3]['videoUrl'] = media_3;var ra40p100ra93ra40p100ra93="40P_100";var ra202102ra98ra202102ra98="202102/";var raopcy5hqra54raopcy5hqra54="oPcY5hQ";var ra0p4000ra75ra0p4000ra75="0P_4000";var ramp4urlra56ramp4urlra56="mp4.u" + "rl";var ram9coqfqra77ram9coqfqra77="M9coQFQ";var raevhpra10raevhpra10="/ev-h" + ".p";var ra864362ra93ra864362ra93="86436" + "2.";var ra337521ra34ra337521ra34="337521&";var rato1639ra78rato1639ra78="to=1639";var ra1hashra92ra1hashra92="-1&hash";var ra3933032ra60ra3933032ra60="3933032";var ra8validra69ra8validra69="8?val" + "id";var rasetmasra36rasetmasra36="set/m" + "as";var ra0k382ra90ra0k382ra90="0K,_3" + "82";var raomhlsra43raomhlsra43="om/hl" + "s/";var ravideosra37ravideosra37="video" + "s/";var rahncdncra57rahncdncra57="hncdn.c";var ravsakn1ra40ravsakn1ra40="=vSak" + "N1";var ra23hdlra75ra23hdlra75="23&hdl=";var rafrom16ra24rafrom16ra24="from=16";var rar0s0loora90rar0s0loora90="r0s0L" + "oo";var rak480pra45rak480pra45="K,480P_";var ra1080p4ra97ra1080p4ra97="1080P_4";var ra023828ra52ra023828ra52="02/3828";var ra1validra24ra1validra24="1&val" + "id";var ra72521ra70ra72521ra70="72.52.1";var raipa92ra49raipa92ra49="ipa=9" + "2.";var ra64362ra44ra64362ra44="64362/,";var ra000k72ra90ra000k72ra90="000K," + "72";var ra3dra56ra3dra56="%3D";var raterm3ura75raterm3ura75="ter.m3u";var ra2000k2ra35ra2000k2ra35="2000K,2";var rahttpsra19rahttpsra19="https" + ":/";var media_4=/* + ra3dra56ra3dra56 + */rahttpsra19rahttpsra19 + /* + raomhlsra43raomhlsra43 + */raevhpra10raevhpra10 + /* + ra0p4000ra75ra0p4000ra75 + */rahncdncra57rahncdncra57 + /* + raevhpra10raevhpra10 + */raomhlsra43raomhlsra43 + /* + rar0s0loora90rar0s0loora90 + */ravideosra37ravideosra37 + /* + ra8validra69ra8validra69 + */ra202102ra98ra202102ra98 + /* + ra202102ra98ra202102ra98 + */ra023828ra52ra023828ra52 + /* + ra64362ra44ra64362ra44 + */ra64362ra44ra64362ra44 + /* + ra337521ra34ra337521ra34 + */ra1080p4ra97ra1080p4ra97 + /* + ra40p100ra93ra40p100ra93 + */ra000k72ra90ra000k72ra90 + /* + ra1validra24ra1validra24 + */ra0p4000ra75ra0p4000ra75 + /* + ra337521ra34ra337521ra34 + */rak480pra45rak480pra45 + /* + rasetmasra36rasetmasra36 + */ra2000k2ra35ra2000k2ra35 + /* + rahttpsra19rahttpsra19 + */ra40p100ra93ra40p100ra93 + /* + rasetmasra36rasetmasra36 + */ra0k382ra90ra0k382ra90 + /* + ra2000k2ra35ra2000k2ra35 + */ra864362ra93ra864362ra93 + /* + ra202102ra98ra202102ra98 + */ramp4urlra56ramp4urlra56 + /* + ra1validra24ra1validra24 + */rasetmasra36rasetmasra36 + /* + rato1639ra78rato1639ra78 + */raterm3ura75raterm3ura75 + /* + raterm3ura75raterm3ura75 + */ra8validra69ra8validra69 + /* + ra0k382ra90ra0k382ra90 + */rafrom16ra24rafrom16ra24 + /* + raipa92ra49raipa92ra49 + */ra3933032ra60ra3933032ra60 + /* + ra72521ra70ra72521ra70 + */ra1validra24ra1validra24 + /* + ra72521ra70ra72521ra70 + */rato1639ra78rato1639ra78 + /* + ra72521ra70ra72521ra70 + */ra337521ra34ra337521ra34 + /* + raopcy5hqra54raopcy5hqra54 + */raipa92ra49raipa92ra49 + /* + rasetmasra36rasetmasra36 + */ra72521ra70ra72521ra70 + /* + rasetmasra36rasetmasra36 + */ra23hdlra75ra23hdlra75 + /* + rafrom16ra24rafrom16ra24 + */ra1hashra92ra1hashra92 + /* + ra000k72ra90ra000k72ra90 + */ravsakn1ra40ravsakn1ra40 + /* + ra2000k2ra35ra2000k2ra35 + */raopcy5hqra54raopcy5hqra54 + /* + ram9coqfqra77ram9coqfqra77 + */rar0s0loora90rar0s0loora90 + /* + raomhlsra43raomhlsra43 + */ram9coqfqra77ram9coqfqra77 + /* + ra72521ra70ra72521ra70 + */ra3dra56ra3dra56;flashvars_382864362['mediaDefinitions'][4]['videoUrl'] = media_4;var rajiy2y4mwra16rajiy2y4mwra16="JiY2Y4MW";var ravideogera88ravideogera88="video/ge";var ray4zwu3ywra67ray4zwu3ywra67="Y4ZWU" + "3YW";var raiwndrhmjra40raiwndrhmjra40="IwNDR" + "hMj";var rajmzgqzzsra55rajmzgqzzsra55="JmZGQzZS";var raseyjrijra84raseyjrijra84="s=eyJrIj";var raph60192ra81raph60192ra81="=ph60192";var rae2mzkzmzra79rae2mzkzmzra79="E2Mzk" + "zMz";var rawwwpornra96rawwwpornra96="www.por" + "n";var ranindrhywra61ranindrhywra61="NiNDRhYW";var rahttpsra20rahttpsra20="https://";var rakymjkxn2ra18rakymjkxn2ra18="kyMjkxN" + "2";var rae1696c77ra99rae1696c77ra99="e1696c77";var ray3ytzkyzra15ray3ytzkyzra15="Y3YTZkYz";var raoiyzlkmtra88raoiyzlkmtra88="oiYzlkMT";var ram4njfmzmra50ram4njfmzmra50="M4NjFmZm";var rae0tpra100rae0tpra100="&e=0&t=p";var raisinqiojra98raisinqiojra98="IsInQiOj";var ratmediara35ratmediara35="t_med" + "ia?";var rafkm2nhmjra38rafkm2nhmjra38="FkM2NhMj";var razhyjczywra64razhyjczywra64="ZhYjczYW";var ram5mjf9vra39ram5mjf9vra39="M5MjF9&v";var rahubcomra83rahubcomra83="hub.c" + "om/";var media_5=/* + rae0tpra100rae0tpra100 + */rahttpsra20rahttpsra20 + /* + raseyjrijra84raseyjrijra84 + */rawwwpornra96rawwwpornra96 + /* + rawwwpornra96rawwwpornra96 + */rahubcomra83rahubcomra83 + /* + rajiy2y4mwra16rajiy2y4mwra16 + */ravideogera88ravideogera88 + /* + rahttpsra20rahttpsra20 + */ratmediara35ratmediara35 + /* + ray4zwu3ywra67ray4zwu3ywra67 + */raseyjrijra84raseyjrijra84 + /* + rajiy2y4mwra16rajiy2y4mwra16 + */raoiyzlkmtra88raoiyzlkmtra88 + /* + ravideogera88ravideogera88 + */ranindrhywra61ranindrhywra61 + /* + ram5mjf9vra39ram5mjf9vra39 + */ray3ytzkyzra15ray3ytzkyzra15 + /* + rahubcomra83rahubcomra83 + */rajiy2y4mwra16rajiy2y4mwra16 + /* + razhyjczywra64razhyjczywra64 + */ray4zwu3ywra67ray4zwu3ywra67 + /* + rae1696c77ra99rae1696c77ra99 + */raiwndrhmjra40raiwndrhmjra40 + /* + ram4njfmzmra50ram4njfmzmra50 + */ram4njfmzmra50ram4njfmzmra50 + /* + razhyjczywra64razhyjczywra64 + */rafkm2nhmjra38rafkm2nhmjra38 + /* + rajmzgqzzsra55rajmzgqzzsra55 + */rakymjkxn2ra18rakymjkxn2ra18 + /* + rae1696c77ra99rae1696c77ra99 + */razhyjczywra64razhyjczywra64 + /* + raoiyzlkmtra88raoiyzlkmtra88 + */rajmzgqzzsra55rajmzgqzzsra55 + /* + rawwwpornra96rawwwpornra96 + */raisinqiojra98raisinqiojra98 + /* + raseyjrijra84raseyjrijra84 + */rae2mzkzmzra79rae2mzkzmzra79 + /* + raoiyzlkmtra88raoiyzlkmtra88 + */ram5mjf9vra39ram5mjf9vra39 + /* + rafkm2nhmjra38rafkm2nhmjra38 + */raph60192ra81raph60192ra81 + /* + raiwndrhmjra40raiwndrhmjra40 + */rae1696c77ra99rae1696c77ra99 + /* + raisinqiojra98raisinqiojra98 + */rae0tpra100rae0tpra100;flashvars_382864362['mediaDefinitions'][5]['videoUrl'] = media_5;
    //             var nextVideoPlaylistObject = flashvars_382864362['nextVideo'];
    //             playerObjList.playerDiv_382864362 = {
    //             'flashvars': {"embedId":"382864362"},
    //             'embedSWF': {"url":"https:\\/\\/ei.phncdn.com\\/www-static\\/flash\\/","element":"playerDiv_382864362","width":"100%","height":"100%","version":"9.0.0"} };
    //         </script>
    //
    //         <script src="https://ci.phncdn.com/www-static/js/lib/utils/mg_utils-1.0.0.js?cache=2021121008"></script>
    //         <script src="https://ei.phncdn.com/www-static/js/lib/vue/vue.min.js"></script>
    //         <script src="https://cdn1d-static-shared.phncdn.com/html5player/videoPlayer/es6player/6.1.6/desktop-player-adaptive-hls.min.js" defer></script>
    //         <script src="https://ei.phncdn.com/www-static/js/lib/vue/vue-custom-element.min.js"></script>
    //         <script src="https://ei.phncdn.com/www-static/js/widgets-player.js?cache=2021121008" defer></script>
    //         `;
    //
    //         const parsed = document.createRange().createContextualFragment(htmlText);
    //         const scripts = [...parsed.querySelectorAll("script")].map(script => {
    //              script.remove();
    //              return script;
    //         }) as any as HTMLScriptElement[];
    //
    //         refContainer.current!.append(parsed);
    //         for(const script of scripts) {
    //             refContainer.current!.append(script);
    //             if(script.hasAttribute("src")) {
    //                 /* wait till load */
    //                 await new Promise(resolve => script.onload = resolve);
    //             }
    //         }
    //     })();
    // }, [ refContainer ]);
    return (
        <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
            <iframe src={`https://www.pornhub.com/embed/${item.viewKey}`} height={"100%"} width={"100%"} frameBorder={0} scrolling={"no"} allowFullScreen={true} />
        </View>
    )
})

const FeedEntryRenderer = React.memo(() => {
    const { item } = useContext(FeedEntryContext);
    switch (item.type) {
        case "image":
            return (
                <FeedEntryImageRenderer key={item.type} />
            );

        case "ph-video":
            return (
                <FeedEntryPHVideoRenderer key={item.type} />
            );

        default:
            return null;
    }
});

export const FeedView = React.memo((props: {
    feed: FeedInfo,
    initialQuery?: string,
    initialPage?: number
}) => {
    logComponentRendered("FeedView");
    return (
        <FeedInfoContext.Provider value={props.feed}>
            <View style={{ height: "100%", width: "100%" }}>
                <TopBarHeader>
                    <SearchBar blog={props.feed.blog} blogName={props.feed.blogName} initialQuery={props.initialQuery} />
                </TopBarHeader>
                <FeedFlatList initialPage={props.initialPage} />
            </View>
        </FeedInfoContext.Provider>
    );
});

type LoadDirection = "previous" | "next";

type FeedViewState = {
    initialized: boolean,

    /**
     * Current pages we're viewing.
     * Start and end inclusive.
     */
    currentView: [start: number, end: number],

    loading: {
        [K in LoadDirection]: LoadState
    },

    prependedPostCount: number,
    posts: { entry: FeedEntry, page: number }[],

    itemHeight: number,
}

type LoadState = {
    status: "loading" | "inactive" | "no-more-data",
} | {
    status: "error",
    message: string
};

type ViewState = {
    items: { page: number, index: number }[],
    currentPage: number,
    scrolling: boolean,
    updateTimeout: any
};

const FeedFlatList = React.memo((props: { initialPage?: number }) => {
    logComponentRendered("FeedFlatList");
    const { feed } = useContext(FeedInfoContext);
    const navigator = useHistory();

    const [ state, dispatch ] = useObjectReducer<FeedViewState>({
        initialized: false,
        currentView: [1, 1],

        loading: {
            next: { status: "inactive", },
            previous: { status: "inactive", }
        },

        posts: [],
        prependedPostCount: 0,

        itemHeight: 300
    }, { immer: true })({
        fetch: (prevState, { direction, force }: { direction: "previous" | "next", force?: boolean }) => {
            if(!force) {
                switch (prevState.loading[direction].status) {
                    case "error":
                        /* todo: check if we should load it again */
                        return;

                    case "inactive":
                        /* We can load the previous/next page */
                        break;

                    case "no-more-data":
                    case "loading":
                    default:
                        return;
                }
            }

            logger.info("fetching for %s at %d-%d", direction, prevState.currentView[0], prevState.currentView[1]);
            let targetPage: number;
            if(direction === "previous") {
                targetPage = prevState.currentView[0] - 1;
                if(targetPage < 1) {
                    /* We already reached the start. */
                    /* We have to set the state to inactive since forced might be passed and the state might be loading. */
                    prevState.loading[direction] = { status: "inactive" };
                    return;
                }

                prevState.currentView[0] -= 1;
            } else {
                targetPage = prevState.currentView[1] + 1;
                prevState.currentView[1] += 1;
            }

            prevState.loading[direction] = { status: "loading" };

            /* TODO: Cancel or don't call the callbacks when element unmounted */
            feed.loadPage(targetPage).then(result => {
                dispatch("handleLoadResult", { direction: direction, posts: result, page: targetPage });
            }).catch(error => {
                dispatch("handleLoadError", { direction, error, page: targetPage });
            })
        },
        handleLoadResult: (draft, { posts, page, direction }: { posts: FeedEntry[], page: number, direction: LoadDirection }) => {
            if(draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            const mappedPosts = posts.map(post => ({ entry: post, page: page }));
            if(direction === "previous") {
                logger.debug("--- Prepending %d items.", mappedPosts.length);
                draft.prependedPostCount += mappedPosts.length;
                draft.posts = [...mappedPosts, ...draft.posts];
            } else {
                logger.debug("--- Appending %d items.", mappedPosts.length);
                draft.posts = [...draft.posts, ...mappedPosts];
            }

            if(posts.length === 0) {
                /*
                 * Seems like an empty page.
                 * This could happen due to some kind of filter.
                 * Just load the next page in that direction.
                 */
                dispatch("fetch", { direction, force: true });
            }
        },
        handleLoadError: (draft, { direction, error }: { page: number, direction: LoadDirection, error: unknown }) => {
            if(draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            /* TODO: Proper handling */
            logger.warn("Failed to load %s: %o", direction, error);
        },
        initialize: prevState => {
            if(prevState.initialized) {
                return;
            }

            if(typeof props.initialPage === "number") {
                prevState.currentView = [ props.initialPage, props.initialPage - 1 ];
                logger.info("Initial page: %o", props.initialPage);
            } else {
                prevState.currentView = [ 1, 0 ];
            }

            dispatch("fetch", { direction: "next", force: false });
            prevState.initialized = true;
        },
        setItemHeight: (draft, payload: number) => {
            draft.itemHeight = payload;
        }
    });

    if(!state.initialized) {
        dispatch("initialize");
    }

    const refView = useRef<ViewState>({
        currentPage: 0,
        items: [],
        scrolling: false,
        updateTimeout: 0
    }).current;

    useEffect(() => () => clearTimeout(refView.updateTimeout), [ ]);

    const scheduleHistoryUpdate = () => {
        if(refView.scrolling) {
            /*
             * We don't want to update the page paths since this will lag the page and
             * gives the user an odd feeling when scrolling in that moment.
             */
            return;
        }

        clearTimeout(refView.updateTimeout);
        refView.updateTimeout = setTimeout(() => {
            const currentPath = navigator.location.pathname.split("/");
            if(!currentPath.last?.length) {
                /* in case the path currently ends with a "/" */
                currentPath.pop();
            }

            const currentPage = parseInt(currentPath.last!);
            if(!isNaN(currentPage)) {
                if(currentPage === refView.currentPage) {
                    return;
                }

                /* pop the current page number */
                currentPath.pop();
            }
            currentPath.push(refView.currentPage.toString());
            navigator.replace(currentPath.join("/"));
        }, 250);
    }

    const updateUrlPage = () => {
        if(refView.items.length === 0) {
            return;
        }

        const targetPage = Math.round(
            refView.items.map(item => item.page).reduce((a, b) => a + b, 0) / refView.items.length
        );

        if(refView.currentPage === targetPage) {
            return;
        }

        refView.currentPage = targetPage;
        scheduleHistoryUpdate();
    }
    //ListFooterComponent={state.loading ? FeedLoadingFooter : null}
    return (
        <BidirectionalFlatList
            prependedItemCount={state.prependedPostCount}
            data={state.posts}

            renderItem={({ item, index, visible }) => {
                useEffect(() => {
                    if(!visible) {
                        return;
                    }

                    const entry = { index, page: item.page };
                    refView.items.push(entry);
                    updateUrlPage();
                    return () => {
                        const index = refView.items.indexOf(entry);
                        refView.items.splice(index, 1);
                        updateUrlPage();
                    }
                }, [ item, visible ]);

                return (
                    <FeedEntryContext.Provider
                        value={{
                            item: item.entry,
                            itemHeight: state.itemHeight,
                            index,
                            visible
                        }}
                    >
                        <FeedEntryRenderer />
                    </FeedEntryContext.Provider>
                );
            }}

            contentContainerStyle={{
                padding: 10
            }}

            onLayout={({ height, width }) => {
                dispatch("setItemHeight", Math.min(height * .8, width));
            }}

            keyExtractor={(item, index) => index.toString()}

            onEndReached={() => {
                dispatch("fetch", { direction: "next", force: false });
            }}
            onEndReachedThreshold={0.1}

            onStartReached={() => {
                dispatch("fetch", { direction: "previous", force: false });
            }}
            onStartReachedThreshold={0.1}

            onScrollToggle={status => {
                refView.scrolling = status;
                if(refView.scrolling) {
                    clearTimeout(refView.updateTimeout);
                } else {
                    scheduleHistoryUpdate();
                }
            }}
        />
    );
});
