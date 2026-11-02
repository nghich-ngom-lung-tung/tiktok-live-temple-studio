// Original Vietnamese reflections inspired by the references below; no verbatim Bible quotations.
const { randomInt } = require('node:crypto');
const GROUPS = [
  ['duc-tin', 'Đức tin & chở che', 'Thi Thiên 23:1', 'psalms/23', `
Người dẫn đường|Khi chưa biết bước tiếp ra sao, hãy dâng điều lo lắng lên Chúa và làm việc thiện nhỏ trước mắt. Đức tin được nuôi bằng những bước chân trung tín mỗi ngày.
Không đi một mình|Có lúc bạn thấy mình lạc lõng giữa đám đông. Hãy dành một lời cầu nguyện chân thành và mở lòng với người đáng tin; bạn không cần gánh hết mọi điều một mình.
Đủ cho hôm nay|Đừng để điều mình chưa có che khuất những gì đang nâng đỡ mình. Xin Chúa giúp ta nhận ra phần đủ của hôm nay và biết chia sẻ với người thiếu thốn.
Đi qua thung lũng|Một chặng đường khó không làm mất giá trị của đời bạn. Hãy xin Chúa nâng đỡ, tìm sự đồng hành và kiên nhẫn đi từng bước trong khả năng của mình.
Giữ lòng ngay thẳng|Niềm tin không chỉ nằm trong điều ta nói. Hôm nay, hãy chọn một việc trung thực dù không ai nhìn thấy, như một cách đáp lại sự dẫn dắt của Chúa.
Một điểm tựa|Khi kế hoạch thay đổi, ta có thể mất phương hướng. Hãy trở về với lời cầu nguyện, nhìn lại điều cốt lõi và chọn bước tiếp theo bằng sự bình tĩnh.
Tin trong điều nhỏ|Một lời hứa được giữ, một việc tử tế được làm đến cùng đều có ý nghĩa. Xin Chúa giúp ta sống đức tin qua những điều nhỏ bé và bền bỉ.
Học cách phó thác|Phó thác không phải bỏ mặc trách nhiệm. Hãy làm phần việc của mình cách tận tâm, rồi dâng lên Chúa những điều vượt ngoài khả năng kiểm soát.
Nhìn lại hành trình|Hãy nhớ một lần mình được giúp đỡ khi tưởng không còn lối ra. Xin ký ức ấy nuôi lòng biết ơn và khích lệ ta nâng đỡ một người khác hôm nay.
Trở về nguồn cậy trông|Giữa nhiều tiếng gọi trái chiều, hãy dành một khoảng lặng để hướng lòng về Chúa. Xin cho lựa chọn hôm nay được dẫn dắt bởi sự thật và lòng nhân ái.
`],
  ['binh-an', 'Bình an', 'Giăng 14:27', 'john/14', `
Bình an giữa bộn bề|Bình an không đòi mọi việc phải hoàn hảo. Xin Chúa giữ lòng ta vững vàng, để giữa những điều còn dang dở, ta vẫn có thể nói và làm bằng tình thương.
Trước một lời đáp|Khi muốn trả lời trong nóng giận, hãy dừng lại một chút. Xin Chúa giúp ta nói điều chân thật mà không làm tổn thương người đang ở trước mặt.
Đặt xuống nỗi lo|Bạn có thể gọi tên điều mình lo trong lời cầu nguyện. Sau đó, hãy chọn một việc có thể làm hôm nay và để ngày mai có khoảng trời riêng của nó.
Một mái nhà yên|Bình an trong nhà được vun từ những lời nói hằng ngày. Hôm nay, hãy bớt một lời trách móc và thêm một câu hỏi han chân thành với người thân.
Giữ lòng trước tin dữ|Khi tin xấu làm lòng bất an, hãy cầu nguyện và kiểm tra điều mình nghe trước khi chia sẻ. Xin cho ta đem sự sáng suốt đến người khác thay vì thêm hoang mang.
Nhẹ lòng cuối ngày|Trước khi nghỉ, hãy dâng lên Chúa một điều chưa trọn vẹn. Nhận phần trách nhiệm của mình, xin ơn sửa đổi và cho bản thân cơ hội bắt đầu lại ngày mai.
Bình an trong khác biệt|Ta không cần đồng ý mọi điều để tôn trọng nhau. Xin Chúa giúp ta lắng nghe điều người khác đang lo và tìm một cách đối thoại không hạ thấp ai.
Ở lại với hiện tại|Đừng để những giả định về ngày mai lấy hết sự hiện diện hôm nay. Hãy cầu nguyện ngắn, trở về với công việc trước mắt và đối xử dịu dàng với người bên cạnh.
Làm người nối nhịp|Nếu có thể, hãy là người mở đầu một cuộc trò chuyện hòa nhã. Một lời chào không giải quyết mọi bất đồng, nhưng có thể tạo chỗ cho bình an lớn lên.
Bình an để sẻ chia|Khi lòng mình đã yên hơn, hãy nhớ đến người đang bối rối. Xin Chúa giúp ta trở thành người biết nghe, thay vì vội đưa ra lời phán xét.
`],
  ['hy-vong', 'Hy vọng & kiên trì', 'Rô-ma 12:12', 'romans/12', `
Bước nhỏ vẫn tiến|Một tiến bộ nhỏ cũng đáng được ghi nhận. Xin Chúa ban lòng kiên trì để ta không bỏ điều tốt chỉ vì chưa thấy kết quả như mong đợi.
Sau một lần thất bại|Thất bại có thể chỉ ra điều cần học, không quyết định toàn bộ giá trị của bạn. Hãy cầu nguyện, nhận sự hỗ trợ và chọn một cách thử lại khôn ngoan hơn.
Chờ đợi có ý nghĩa|Trong lúc chờ một câu trả lời, bạn vẫn có thể sống tử tế hôm nay. Xin Chúa giúp ta chăm sóc phần đời hiện tại thay vì chỉ sống cho điều chưa đến.
Một đốm sáng|Hãy tìm một điều tốt dù nhỏ trong ngày khó khăn. Không phải để phủ nhận nỗi buồn, mà để nhớ rằng hành trình vẫn còn những người và những điều đáng quý.
Kiên trì cầu nguyện|Có những điều ta chưa hiểu và chưa thể thay đổi. Xin cho lời cầu nguyện giúp ta giữ lòng chân thành, biết nhờ giúp đỡ và không đánh mất sự quan tâm đến người khác.
Bắt đầu lại|Bạn không cần đợi một ngày thật đặc biệt để sửa một thói quen. Hãy xin Chúa nâng đỡ và bắt đầu bằng một lựa chọn tốt có thể thực hiện ngay hôm nay.
Đi cùng người nản chí|Đừng vội bảo một người đang buồn phải mạnh mẽ. Hãy ở lại, nghe họ nói và cùng họ tìm một bước nhỏ khả thi. Sự hiện diện cũng có thể nuôi hy vọng.
Nuôi điều tốt lâu dài|Điều tốt thường cần thời gian để bén rễ. Xin Chúa cho ta sự nhẫn nại khi chăm sóc gia đình, công việc và những mối quan hệ đáng quý.
Không so hành trình|Mỗi người có nhịp bước và hoàn cảnh riêng. Hãy bớt so sánh, nhìn lại điều mình đã học và xin Chúa giúp mình trung thành với phần việc được trao.
Hy vọng bằng hành động|Hy vọng không chỉ là mong điều tốt sẽ đến. Hôm nay, hãy làm một việc góp phần cho điều tốt ấy: hỏi thăm, sửa sai hoặc giúp một người đang cần.
`],
  ['nghi-ngoi', 'An ủi & nghỉ ngơi', 'Ma-thi-ơ 11:28', 'matthew/11', `
Cho lòng được nghỉ|Bạn không cần chứng minh giá trị bằng sự kiệt sức. Hãy dâng ngày sống lên Chúa, tạm dừng khi cần và đón nhận sự chăm sóc từ những người yêu thương.
Khi thấy quá tải|Hãy gọi tên một điều đang làm mình nặng lòng và nói với người đáng tin. Xin Chúa ban sự bình tĩnh để ta biết việc nào cần làm, việc nào có thể chờ.
Một lời an ủi|Đôi khi người đang buồn cần được nghe hơn là được khuyên. Xin Chúa cho ta sự nhạy cảm để ở bên họ với một lời vừa đủ và một tấm lòng không vội vã.
Không phải luôn mạnh|Có những ngày bạn cần nghỉ và nhờ người khác giúp. Hãy đón nhận giới hạn ấy bằng sự thành thật, và xin Chúa gìn giữ lòng mình khỏi những lời tự trách nặng nề.
Trong ngày cô đơn|Nếu hôm nay thấy lẻ loi, hãy thử gửi một lời hỏi thăm đến người bạn tin tưởng. Xin Chúa mở ra những cuộc gặp gỡ có thể nâng đỡ và nối lại sự gần gũi.
Thả bớt gánh nặng|Không phải mọi yêu cầu đều cần một lời đồng ý. Hãy xin Chúa giúp ta biết giới hạn của mình, để sự phục vụ được bền bỉ và không đánh đổi bằng kiệt quệ.
Khi người thân đau yếu|Xin Chúa nâng đỡ người đang đau và những ai chăm sóc họ. Hôm nay, ta có thể đem đến một bữa ăn, một cuộc gọi hoặc một khoảng nghỉ thiết thực cho gia đình ấy.
Ở bên người mất mát|Trước nỗi mất mát, đừng ép ai phải chóng nguôi ngoai. Xin cho ta biết đồng hành bằng sự tôn trọng, nhớ đến họ trong lời cầu nguyện và giúp điều họ thật sự cần.
Nghỉ để yêu thương|Một khoảng nghỉ đúng lúc giúp ta trở về với người thân bằng lòng kiên nhẫn hơn. Hãy chăm sóc thân tâm như một phần trách nhiệm với cuộc sống Chúa đã trao.
Đón nhận sự dịu dàng|Hãy nói với chính mình bằng sự tử tế mà bạn dành cho người bạn quý mến. Xin Chúa giúp ta nhìn nhận lỗi lầm để sửa đổi mà không phủ nhận giá trị của bản thân.
`],
  ['gia-dinh', 'Gia đình & trẻ nhỏ', 'Mác 10:14–16', 'mark/10', `
Lắng nghe trẻ nhỏ|Hãy dành cho một đứa trẻ vài phút được nói mà không bị ngắt lời. Xin Chúa giúp người lớn nhìn thấy sự quý giá của các em và tạo một nơi an toàn để các em lớn lên.
Một bữa cơm gần nhau|Trong bữa ăn hôm nay, hãy đặt điện thoại xuống một lúc và hỏi người thân về ngày của họ. Sự gần gũi thường được vun từ những điều rất bình thường.
Dịu dàng khi dạy dỗ|Khi một đứa trẻ làm sai, hãy giúp em hiểu điều cần sửa mà không làm em thấy mình bị ghét bỏ. Xin Chúa cho người lớn sự kiên nhẫn và cách hướng dẫn phù hợp.
Nhớ người ở xa|Một cuộc gọi ngắn có thể làm ấm lòng người thân đang xa nhà. Hãy dành lời hỏi han thật lòng, để khoảng cách không trở thành sự lãng quên.
Trẻ nhỏ cũng có tiếng nói|Đừng xem nhẹ nỗi buồn chỉ vì người buồn còn nhỏ tuổi. Xin Chúa giúp ta nghe những điều các em chưa biết diễn đạt và tìm sự hỗ trợ thích hợp khi cần.
Xin lỗi trong gia đình|Người lớn cũng có thể nói lời xin lỗi. Khi nhận ra mình đã nóng giận, hãy sửa cách cư xử để trẻ học được rằng yêu thương đi cùng trách nhiệm.
Một lời khích lệ|Hôm nay, hãy ghi nhận một nỗ lực của người thân thay vì chỉ nhìn kết quả. Xin Chúa giúp gia đình trở thành nơi mỗi người được nâng đỡ để trưởng thành.
Chăm người chăm sóc|Người lo cho gia đình cũng cần được nghỉ và được hỏi han. Hãy chia sẻ một việc cụ thể, để yêu thương không chỉ nằm trong lời cảm ơn.
Đón nhận khác biệt|Các thành viên có thể có sở thích và nhịp sống khác nhau. Xin Chúa giúp ta tìm cách tôn trọng, trò chuyện và cùng giữ những giới hạn cần thiết cho sự an toàn.
Mái ấm của sự hiện diện|Một mái ấm không được tạo chỉ bằng đồ đạc đầy đủ. Hãy dành thời gian có mặt, lắng nghe và giữ lời hứa, để người thân cảm nhận được mình được yêu thương.
`],
  ['yeu-thuong', 'Yêu thương & nhẫn nại', '1 Cô-rinh-tô 13:4–7', '1corinthians/13', `
Yêu bằng việc nhỏ|Một việc nhỏ làm bằng sự quan tâm có thể nói nhiều hơn lời hứa lớn. Hôm nay, hãy giúp một người theo điều họ cần, thay vì chỉ theo điều mình muốn cho.
Kiên nhẫn để hiểu|Khi người khác chưa làm được như mình mong, hãy tìm hiểu hoàn cảnh của họ. Xin Chúa cho ta lòng nhẫn nại mà vẫn biết trao đổi rõ ràng và tôn trọng.
Mừng cho người khác|Thành công của người khác không làm giảm giá trị của bạn. Hãy tập gửi một lời chúc mừng chân thành và biết ơn những khả năng riêng mình đang có.
Nói sự thật bằng tình thương|Một lời góp ý có ích cần cả sự thật lẫn lòng tôn trọng. Xin Chúa giúp ta chọn lúc thích hợp và nói với mong muốn xây dựng, không phải để thắng thế.
Không lấy lỗi để hơn thua|Đừng biến lỗi cũ của người khác thành vũ khí trong mọi cuộc tranh luận. Hãy tập trung vào việc cần giải quyết và giữ trách nhiệm của mỗi người thật rõ ràng.
Tình thương biết lắng nghe|Bạn có thể chưa hiểu hết một nỗi buồn, nhưng vẫn có thể nghe với lòng tôn trọng. Xin Chúa giúp ta chậm phán đoán và dành chỗ cho câu chuyện của người khác.
Sự tử tế không phô trương|Có những việc tốt chỉ cần được làm âm thầm. Hãy giúp đỡ mà không khiến người nhận phải xấu hổ, để phẩm giá của họ luôn được giữ gìn.
Quan tâm đúng cách|Yêu thương không có nghĩa quyết định thay mọi điều cho người khác. Hãy hỏi ý kiến, tôn trọng sự lựa chọn và giúp họ có thêm khả năng tự bước đi.
Giữ lời trong yêu thương|Nếu đã hứa một điều vừa sức, hãy cố gắng thực hiện. Khi không thể làm được, hãy nói rõ và nhận trách nhiệm, vì sự tin cậy cần được chăm sóc mỗi ngày.
Tình thương có giới hạn lành mạnh|Sự nhẫn nại không buộc ai phải chịu đựng bạo lực hay bị làm hại. Xin Chúa giúp ta biết tìm nơi an toàn và sự hỗ trợ, trong khi vẫn giữ lòng không thù hận.
`],
  ['tha-thu', 'Tha thứ & hòa giải', 'Ê-phê-sô 4:32', 'ephesians/4', `
Mở lòng sửa sai|Khi biết mình làm tổn thương ai, hãy nhận lỗi cụ thể thay vì tìm lý do biện hộ. Xin Chúa cho ta can đảm sửa hành động và tôn trọng thời gian người ấy cần.
Một khởi đầu hòa giải|Một lời hỏi han chân thành có thể mở đường cho đối thoại. Hãy đến với mong muốn hiểu và sửa điều sai, không phải để buộc người khác phải quên ngay.
Đặt xuống ý muốn trả đũa|Cơn giận có thể cho biết ta đã bị tổn thương. Xin Chúa giúp ta tìm cách bảo vệ điều đúng mà không biến nỗi đau thành việc làm hại thêm một người.
Tha thứ cần thời gian|Có những vết thương không thể nguôi sau một cuộc trò chuyện. Hãy xin Chúa nâng đỡ và tìm sự đồng hành, để tiến trình chữa lành được diễn ra theo nhịp phù hợp.
Nhìn lại lời nói|Trước khi nhắc một lỗi lầm, hãy tự hỏi mình muốn xây dựng hay làm người khác xấu hổ. Xin Chúa giúp ta góp ý bằng lời rõ ràng, có trách nhiệm và nhân hậu.
Được tha thứ để đổi thay|Đón nhận lòng thương xót không phải xem nhẹ điều sai. Hãy để sự tha thứ khích lệ ta bù đắp khi có thể và lựa chọn một cách sống có trách nhiệm hơn.
Giữ ranh giới khi hòa giải|Hòa giải cần sự an toàn và thiện chí từ các bên. Xin Chúa cho ta lòng nhân hậu cùng sự khôn ngoan, để không nhầm tha thứ với việc tiếp tục chịu tổn hại.
Xin lỗi không kèm đòi hỏi|Khi nói xin lỗi, đừng đòi người khác lập tức tin tưởng như trước. Hãy để sự nhất quán trong hành động làm chứng cho điều mình thật lòng muốn sửa.
Bớt một lời cay đắng|Hôm nay, hãy thử bỏ một câu mỉa mai mà bạn định nói. Xin Chúa giúp ta chuyển sự bực bội thành một lời trao đổi thành thật về điều mình cần.
Lòng thương xót hằng ngày|Ai cũng có những giới hạn cần được cảm thông. Hãy đối xử nhân hậu mà không che giấu sự thật, để cơ hội sửa đổi được mở ra cho cả mình lẫn người khác.
`],
  ['biet-on', 'Biết ơn & tạ ơn', '1 Tê-sa-lô-ni-ca 5:18', '1thessalonians/5', `
Ba điều đáng quý|Hãy nhớ ba điều nhỏ đã nâng đỡ mình hôm nay: một bữa ăn, một lời hỏi thăm hay một người giữ lời. Xin Chúa giúp lòng biết ơn trở thành cách ta nhìn cuộc sống.
Cảm ơn đúng người|Nếu ai đã giúp bạn, hãy nói rõ điều bạn trân trọng ở họ. Một lời cảm ơn cụ thể nhắc chúng ta rằng những điều tốt thường được trao qua bàn tay người khác.
Biết ơn trong ngày khó|Biết ơn không buộc ta phải gọi nỗi đau là điều dễ chịu. Giữa khó khăn, hãy nhận ra một sự nâng đỡ đang có và xin Chúa giúp mình đón nhận nó.
Quý điều bình thường|Có những điều ta chỉ nhận ra khi thiếu vắng. Hôm nay, hãy trân trọng một thói quen tốt, một người thân hoặc một khoảng thời gian bình yên đang hiện diện.
Tạ ơn bằng sẻ chia|Lòng biết ơn có thể trở thành một hành động. Hãy san sẻ thời gian hay vật dụng còn hữu ích cho người cần, như một cách tiếp nối điều tốt mình đã nhận.
Nhớ những bàn tay âm thầm|Bữa ăn và nơi ở sạch sẽ thường có công sức của nhiều người. Xin Chúa giúp ta nhìn thấy những đóng góp âm thầm và đối xử trân trọng với người phục vụ mình.
Cuối ngày nhìn lại|Trước khi nghỉ, hãy gọi tên một người đã làm ngày của bạn tốt hơn. Nhớ đến họ trong lời cầu nguyện và tìm dịp đáp lại bằng sự quan tâm chân thành.
Không coi tình thương là hiển nhiên|Người thân không phải lúc nào cũng biết mình được trân trọng. Hãy nói lời cảm ơn khi còn có thể, nhất là với những việc họ vẫn lặng lẽ làm mỗi ngày.
Biết ơn khả năng của mình|Hãy nhận ra một khả năng bạn có thể dùng để giúp đời. Xin Chúa cho ta bớt tự cao, bớt tự ti và sử dụng điều được trao với tinh thần phục vụ.
Đón ngày mới|Một ngày mới là cơ hội để sống có trách nhiệm hơn. Hãy tạ ơn Chúa, chọn một việc tốt cụ thể và bước vào ngày hôm nay bằng lòng chú tâm.
`],
  ['khon-ngoan', 'Khôn ngoan & lựa chọn', 'Gia-cơ 1:5', 'james/1', `
Trước một quyết định|Khi đứng trước lựa chọn khó, hãy cầu nguyện, tìm thông tin đáng tin và nghe lời người có kinh nghiệm. Xin Chúa giúp ta nhận ra điều đúng, không chỉ điều dễ.
Chậm lại để hiểu|Một câu chuyện nghe một phía có thể chưa đủ. Hãy tìm hiểu trước khi kết luận, để lời nói của mình không làm tổn thương người chưa có cơ hội được giải thích.
Biết hỏi khi chưa rõ|Không biết một điều không phải là thất bại. Xin Chúa cho ta sự khiêm tốn để hỏi, học và sửa hiểu lầm thay vì cố tỏ ra mình luôn đúng.
Chọn điều bền vững|Một lợi ích trước mắt có thể đi kèm cái giá lâu dài. Hãy cân nhắc ảnh hưởng đến gia đình, người khác và lương tâm trước khi quyết định.
Nghe lời góp ý|Lời góp ý chân thành đôi khi không dễ nghe. Xin Chúa giúp ta phân biệt điều hữu ích, nhận phần cần sửa và không để tự ái ngăn mình trưởng thành.
Giữ sự trung thực|Khi một lời nói dối có vẻ đem lại thuận lợi, hãy nhớ đến sự tin cậy có thể mất đi. Xin Chúa cho ta can đảm chọn sự thật và chịu trách nhiệm về lựa chọn ấy.
Đặt câu hỏi đúng|Thay vì chỉ hỏi mình được gì, hãy hỏi lựa chọn này có làm hại ai không. Xin Chúa giúp ta thấy cả nhu cầu của người yếu thế trong điều mình sắp làm.
Học từ điều đã qua|Hãy nhìn lại một quyết định chưa tốt mà không chỉ tự trách. Xin Chúa giúp ta rút ra bài học cụ thể và đổi một thói quen để lần sau có thể lựa chọn tốt hơn.
Biết lúc cần giúp đỡ|Có những vấn đề cần người có chuyên môn đồng hành. Cầu nguyện và tìm sự trợ giúp phù hợp có thể cùng đi với nhau, giúp ta quyết định có hiểu biết hơn.
Phân biệt điều quan trọng|Không phải việc khẩn cấp nào cũng là điều quan trọng nhất. Hãy dành một phút xem lại ưu tiên, xin Chúa soi sáng và giữ thời gian cho những trách nhiệm cốt lõi.
`],
  ['se-chia', 'Sẻ chia & phục vụ', 'Ga-la-ti 6:2', 'galatians/6', `
Chia bớt một gánh nặng|Hãy hỏi một người đang vất vả xem bạn có thể giúp việc gì cụ thể. Xin Chúa cho ta sự sẵn lòng phục vụ mà vẫn tôn trọng cách họ muốn được hỗ trợ.
Một cuộc gọi đúng lúc|Đừng đợi có lời giải cho mọi vấn đề mới hỏi thăm ai đó. Một cuộc gọi chân thành có thể giúp người đang khó khăn biết rằng họ vẫn được nhớ đến.
Giúp mà không làm thay|Sự giúp đỡ tốt cũng tạo chỗ cho người khác tự quyết định. Hãy trao công cụ, thông tin hoặc thời gian, để họ có thêm sức mạnh đi tiếp hành trình của mình.
Nhìn người dễ bị bỏ quên|Trong cộng đoàn, có người ít nói nên nhu cầu của họ ít được nhận ra. Xin Chúa giúp ta chủ động quan tâm mà không tò mò hay xâm phạm điều riêng tư.
Phục vụ trong khả năng|Bạn không cần làm mọi việc mới được gọi là hữu ích. Hãy chọn một việc vừa sức, thực hiện đến nơi đến chốn và biết nhờ người khác cùng góp phần.
Cho đi với sự tôn trọng|Khi trao một món quà, hãy nhớ người nhận có phẩm giá và quyền lựa chọn. Xin Chúa giúp ta cho đi bằng lòng trân trọng, không biến sự giúp đỡ thành điều kiện ràng buộc.
Cùng nhau làm việc tốt|Một gánh nặng có thể nhẹ hơn khi nhiều người chia nhau. Hãy rủ một người cùng làm việc tử tế, rõ ràng về trách nhiệm và biết cảm ơn phần đóng góp của nhau.
Lắng nghe trước khi giúp|Điều ta nghĩ là hữu ích có thể chưa phải điều người khác cần. Hãy hỏi và nghe trước, để sự giúp đỡ đi cùng sự thấu hiểu thay vì chỉ sự nhiệt tình.
Đón nhận khi mình yếu|Người hay giúp đỡ cũng có lúc cần được nâng đỡ. Xin Chúa giúp ta biết nhận sự hỗ trợ chân thành, vì cộng đoàn được xây dựng bằng cả cho đi lẫn đón nhận.
Tiếp nối sự tử tế|Hãy nhớ một việc tốt mình từng nhận và tìm cách tiếp nối nó cho người khác. Lòng nhân ái có thể lớn lên qua những hành động nhỏ được trao đi mỗi ngày.
`]
];

const SCRIPTURE_CATEGORIES = Object.freeze(GROUPS.map(([id, label]) => Object.freeze({ id, label })));
const SCRIPTURE_CATALOG = Object.freeze(GROUPS.flatMap(([category, theme, reference, chapter, lines], groupIndex) =>
  lines.trim().split('\n').map((line, index) => {
    const [title, reflection] = line.split('|');
    const usePhilippians = category === 'binh-an' && index >= 5;
    return Object.freeze({ id: `${category}-${String(index + 1).padStart(2, '0')}`, number: groupIndex * 10 + index + 1,
      category, categoryLabel: theme, theme, title, reflection,
      reference: usePhilippians ? 'Phi-líp 4:6–7' : reference,
      sourceUrl: category === 'duc-tin' ? 'https://www.biblegateway.com/passage/?search=Psalm+23&version=KJV'
        : `https://bible.usccb.org/bible/${usePhilippians ? 'philippians/4' : chapter}` });
  })
));
const normalize = value => String(value || '').trim().normalize('NFC').toLocaleLowerCase('vi').replace(/[–—]/g, '-');
function findScripture(value) {
  const query = normalize(value);
  if (!query) return null;
  return SCRIPTURE_CATALOG.find(item => normalize(item.id) === query)
    || SCRIPTURE_CATALOG.find(item => normalize(item.reference) === query) || null;
}
function createScripturePicker({ random = randomInt } = {}) {
  const bags = new Map();
  let lastId = '';
  function pick(category = 'all') {
    if (category !== 'all' && !SCRIPTURE_CATEGORIES.some(item => item.id === category) && !SCRIPTURE_CATALOG.some(item => `reference:${normalize(item.reference)}` === category)) throw new Error('Chủ đề suy ngẫm không hợp lệ.');
    let bag = bags.get(category);
    if (!bag?.length) {
      bag = SCRIPTURE_CATALOG.filter(item => category === 'all' || item.category === category || `reference:${normalize(item.reference)}` === category).slice();
      for (let index = bag.length - 1; index > 0; index--) {
        const other = random(index + 1); [bag[index], bag[other]] = [bag[other], bag[index]];
      }
      if (bag.at(-1).id === lastId) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      bags.set(category, bag);
    }
    // Switching topics must not immediately repeat the previous reflection either.
    if (bag.length > 1 && bag.at(-1).id === lastId) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    const selected = bag.pop(); lastId = selected.id; return selected;
  }
  return { pick, pickReference: reference => pick(`reference:${normalize(reference)}`) };
}
module.exports = { SCRIPTURE_CATALOG, SCRIPTURE_CATEGORIES, findScripture, createScripturePicker };
